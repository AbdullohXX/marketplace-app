import session from 'express-session';
import pgSession from 'connect-pg-simple';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import {generateSecret,verify as verifyOtp} from 'otplib';
import {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {rateLimit} from 'express-rate-limit';
import {HttpError,text} from './domain.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
const emailOf=v=>{const email=text(v,'Email',5,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Enter a valid email');return email;};
const password=v=>{if(typeof v!=='string'||v.length<12||v.length>128)throw new HttpError(400,'Use a password with 12–128 characters');return v;};
export function installAuth(app,pool){
 if(process.env.NODE_ENV==='production'&&!(process.env.SESSION_SECRET||process.env.ADMIN_TOKEN))throw new Error('Configure SESSION_SECRET before starting production authentication');
 const secret=process.env.SESSION_SECRET||process.env.ADMIN_TOKEN||randomBytes(48).toString('hex');
 const encryptionKey=createHash('sha256').update(secret).digest();
 const seal=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');};
 const unseal=value=>{const b=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',encryptionKey,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8');};
 app.use('/api',session({store:new(pgSession(session))({pool,tableName:'app_sessions',pruneSessionInterval:900}),secret,name:'savdo.sid',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:86400000}}));
 app.use('/api',async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.session?.uid){const {rows:[u]}=await pool.query('SELECT id,name,email,role,verified,suspended,mfa_enabled,preferences FROM app_users WHERE id=$1',[req.session.uid]);if(u&&!u.suspended)req.user=u;else {delete req.session.uid;req.session.mfa=false;req.session.csrf=randomBytes(24).toString('hex');}}
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const origin=req.get('origin');if(origin&&origin!==(process.env.APP_URL||`${req.protocol}://${req.get('host')}`))throw new HttpError(403,'Request origin is not allowed');
   if(req.user&&req.get('x-csrf-token')!==req.session.csrf)throw new HttpError(403,'Your form session changed. Reload and try again.');
  }next();
 });
 const required=(req,res,next)=>{if(!req.user)throw new HttpError(401,'Please sign in to continue. Your saved work is kept.');next();};
 const privileged=(req,res,next)=>{if(!req.user)throw new HttpError(401,'Sign in required');if(!['moderator','admin','super_admin'].includes(req.user.role))throw new HttpError(403,'Staff permission required');if(!req.user.mfa_enabled||!req.session.mfa)throw new HttpError(403,'Enable and confirm two-factor authentication in Account Security first.');next();};
 const superAdmin=(req,res,next)=>{privileged(req,res,()=>{if(req.user.role!=='super_admin')throw new HttpError(403,'Super administrator permission required');next();});};
 const dummyHash=argon2.hash(randomBytes(32).toString('hex'),{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
 const loginLimit=rateLimit({windowMs:900000,limit:15});
 const regenerate=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
 const save=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
 app.get('/api/auth/me',async(req,res)=>{req.session.csrf ||=randomBytes(24).toString('hex');res.json({user:req.user||null,csrf:req.session.csrf,mfa:!!req.session.mfa,emailDelivery:!!process.env.SMTP_URL});});
 app.post('/api/auth/register',loginLimit,async(req,res)=>{
  const name=text(req.body.name,'Name',2,100),email=emailOf(req.body.email),pw=password(req.body.password);if(req.body.agree!==true)throw new HttpError(400,'Confirm that you understand this is a demonstration marketplace.');
  const passwordHash=await argon2.hash(pw,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
  const {rows:[u]}=await pool.query('INSERT INTO app_users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role,verified',[name,email,passwordHash]);
  await regenerate(req);req.session.uid=u.id;req.session.csrf=randomBytes(24).toString('hex');await save(req);res.status(201).json({user:u,message:'Account created. Email delivery is not configured yet; you can save seller drafts.'});
 });
 app.post('/api/auth/login',loginLimit,async(req,res)=>{
  const email=emailOf(req.body.email);password(req.body.password);const {rows:[u]}=await pool.query('SELECT * FROM app_users WHERE email=$1',[email]);

  let valid=false;try{valid=await argon2.verify(u?.password_hash||await dummyHash,req.body.password);}catch{}
  if(!u||!valid||u.suspended)throw new HttpError(401,'Email or password is incorrect, or account is unavailable.');
  await regenerate(req);req.session.uid=u.id;req.session.csrf=randomBytes(24).toString('hex');await save(req);res.json({message:'Signed in',requiresMfa:['moderator','admin','super_admin'].includes(u.role)});
 });
 app.post('/api/auth/logout',required,async(req,res)=>{await new Promise(resolve=>req.session.destroy(resolve));res.clearCookie('savdo.sid');res.json({message:'Signed out'});});
 app.patch('/api/account/profile',required,async(req,res)=>{await pool.query('UPDATE app_users SET name=$1,preferences=$2 WHERE id=$3',[text(req.body.name,'Name',2,100),JSON.stringify({notifications:req.body.notifications===true}),req.user.id]);res.json({message:'Profile saved'});});
 app.post('/api/account/revoke-sessions',required,async(req,res)=>{await pool.query("DELETE FROM app_sessions WHERE sess->>'uid'=$1",[String(req.user.id)]);req.session.destroy(()=>{});res.clearCookie('savdo.sid');res.json({message:'All sessions revoked. Sign in again.'});});
 app.post('/api/account/password',required,loginLimit,async(req,res)=>{const {rows:[u]}=await pool.query('SELECT password_hash FROM app_users WHERE id=$1',[req.user.id]);if(!await argon2.verify(u.password_hash,req.body.currentPassword||''))throw new HttpError(400,'Current password is incorrect');const pw=await argon2.hash(password(req.body.password),{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});await pool.query('UPDATE app_users SET password_hash=$1 WHERE id=$2',[pw,req.user.id]);await pool.query("DELETE FROM app_sessions WHERE sess->>'uid'=$1",[String(req.user.id)]);req.session.destroy(()=>{});res.clearCookie('savdo.sid');res.json({message:'Password changed. Sign in again.'});});
 async function sendToken(u,kind){
  if(!process.env.SMTP_URL)throw new HttpError(503,'Email delivery is not configured. This action is currently unavailable.');
  const token=randomBytes(32).toString('hex');const transport=nodemailer.createTransport(process.env.SMTP_URL);
  const route=kind==='verify'?'verify-email':'reset-password';
  await pool.query('INSERT INTO app_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,$3,now()+interval \'30 minutes\')',[hash(token),u.id,kind]);
  try{await transport.sendMail({from:process.env.MAIL_FROM,to:u.email,subject:kind==='verify'?'Verify your Savdo email':'Reset your Savdo password',text:`Open ${process.env.APP_URL}/${route}?token=${token}\nThis link expires in 30 minutes.`});}catch{await pool.query('DELETE FROM app_tokens WHERE token_hash=$1',[hash(token)]);throw new HttpError(503,'Email could not be delivered. Try again later.');}
 }
 app.post('/api/auth/resend',required,loginLimit,async(req,res)=>{await sendToken(req.user,'verify');res.json({message:'Verification link sent'});});
 app.post('/api/auth/forgot',loginLimit,async(req,res)=>{if(!process.env.SMTP_URL)throw new HttpError(503,'Password recovery is unavailable until email delivery is configured.');const email=emailOf(req.body.email);const {rows:[u]}=await pool.query('SELECT id,email FROM app_users WHERE email=$1',[email]);if(u)await sendToken(u,'reset');res.json({message:'If an account exists, a recovery link was requested.'});});
 for(const kind of ['verify','reset'])app.post(`/api/auth/${kind}`,loginLimit,async(req,res)=>{
  const token=text(req.body.token,'Token',64,64),client=await pool.connect();try{await client.query('BEGIN');const {rows:[t]}=await client.query('DELETE FROM app_tokens WHERE token_hash=$1 AND kind=$2 AND expires_at>now() RETURNING user_id',[hash(token),kind]);if(!t)throw new HttpError(400,'Link expired or already used. Request a new link.');if(kind==='verify')await client.query('UPDATE app_users SET verified=true WHERE id=$1',[t.user_id]);else{const pw=await argon2.hash(password(req.body.password),{type:argon2.argon2id});await client.query('UPDATE app_users SET password_hash=$1 WHERE id=$2',[pw,t.user_id]);await client.query("DELETE FROM app_sessions WHERE sess->>'uid'=$1",[String(t.user_id)]);}await client.query('COMMIT');res.json({message:kind==='verify'?'Email verified':'Password reset. Sign in again.'});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 });
 app.post('/api/account/mfa/setup',required,async(req,res)=>{if(req.user.mfa_enabled)throw new HttpError(409,'Two-factor authentication is already enabled');const value=generateSecret();req.session.pendingMfa=seal(value);res.json({secret:value,uri:`otpauth://totp/Savdo:${encodeURIComponent(req.user.email)}?secret=${value}&issuer=Savdo`});});
 app.post('/api/account/mfa/confirm',required,loginLimit,async(req,res)=>{const {rows:[u]}=await pool.query('SELECT mfa_secret,mfa_enabled FROM app_users WHERE id=$1',[req.user.id]);const encrypted=u.mfa_enabled?u.mfa_secret:req.session.pendingMfa;if(!encrypted)throw new HttpError(400,'Start MFA setup first');if(!/^\d{6}$/.test(String(req.body.code||'')))throw new HttpError(400,'Enter a six-digit authenticator code');const result=await verifyOtp({secret:unseal(encrypted),token:String(req.body.code)});if(!result.valid)throw new HttpError(400,'Code is incorrect or expired');const {rowCount}=await pool.query('UPDATE app_users SET mfa_secret=$1,mfa_enabled=true,last_otp_step=$2 WHERE id=$3 AND last_otp_step<$2',[encrypted,result.timeStep,req.user.id]);if(!rowCount)throw new HttpError(400,'This code was already used. Wait for a new code.');req.session.mfa=true;delete req.session.pendingMfa;res.json({message:'Two-factor authentication confirmed'});});
 app.post('/api/auth/bootstrap',required,loginLimit,async(req,res)=>{
  const expected=process.env.ADMIN_TOKEN||'',actual=req.get('authorization')?.replace(/^Bearer /,'')||'';
  if(expected.length<32||expected.length!==actual.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))throw new HttpError(403,'Bootstrap authorization required');
  const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(692194)");const {rows}=await c.query("SELECT id FROM app_users WHERE role='super_admin'");if(rows.length)throw new HttpError(409,'First administrator already provisioned');await c.query("UPDATE app_users SET role='super_admin' WHERE id=$1",[req.user.id]);await c.query("INSERT INTO audit_events(actor_id,action,resource,reason) VALUES($1,'bootstrap','account','Controlled first administrator provisioning')",[req.user.id]);await c.query('COMMIT');res.json({message:'Administrator provisioned. Configure and confirm MFA before using administrator tools.'});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 });
 return {required,privileged,superAdmin};
}
