import {el,api} from './workspace-ui-kit.js';
try{const me=await api('/auth/me');window.SavdoCsrf=me.csrf;const link=el('a','identity-link',me.user?'My account':'Sign in');link.href=me.user?'/account/profile':'/login';document.querySelector('.bag-link')?.before(link);
 if(me.user){const shops=el('a','identity-link','Seller workspace');shops.href='/seller';document.querySelector('.footer-tools')?.append(shops);}
 window.addEventListener('savdo:savedtoggle',async e=>{if(me.user)try{await api('/account/saved/'+e.detail.id,{method:'PUT',body:{saved:e.detail.saved}});}catch{document.querySelector('#toast').textContent='Saved on this browser. Account sync failed; try again later.';}});
}catch{/* Public browsing stays available during account service failures. */}
