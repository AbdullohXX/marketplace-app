// Featured collections use the existing category API and clearly labelled demo catalog photos.
const element=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
window.addEventListener('savdo:catalogready',async()=>{
 if(document.querySelector('.discover-banner'))return;
 try{
  const response=await fetch('/api/categories');if(!response.ok)return;const categories=await response.json();
  if(!categories.length)return;
  const hero=document.querySelector('.hero');if(!hero)return;
  const region=element('section','discover-banner');region.setAttribute('aria-label','Featured collections');
  const content=element('div','discover-slides');const dots=element('div','discover-dots');let active=0;const slides=[];const controls=[];
  const edits=[['Sound for\nevery day.','Browse the electronics collection.','01-headphones'],['Make room for\na slower morning.','Explore home pieces for daily rituals.','07-tea'],['Color for\nevery season.','Discover the fashion collection.','03-scarves']];
  categories.slice(0,3).forEach((category,index)=>{
   const [heading,description,imageId]=edits[index];
   const slide=element('div',`discover-slide discover-slide-${index}`);slide.hidden=index!==0;
   const copy=element('div','discover-banner-copy');copy.append(element('span','discover-eyebrow',category.name),element('h1','',heading),element('p','',description));
   const action=element('a','btn','Explore collection →');action.href=`/?category=${category.id}#collection`;copy.append(action);
   const art=element('div','discover-banner-art');const image=element('img','');image.src=`/assets/demo/${imageId}.jpg`;image.alt='';image.width=480;image.height=480;art.append(image);
   slide.append(copy,art);slides.push(slide);content.append(slide);
   const dot=element('button','discover-dot');dot.type='button';dot.setAttribute('aria-label',`Show ${category.name} collection`);dot.setAttribute('aria-pressed',String(index===0));dot.addEventListener('click',()=>show(index));controls.push(dot);dots.append(dot);
  });
  function show(index){active=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=i!==active;controls[i].setAttribute('aria-pressed',String(i===active));});}
  const previous=element('button','discover-arrow previous','‹'),next=element('button','discover-arrow next','›');
  previous.type=next.type='button';previous.setAttribute('aria-label','Previous featured collection');next.setAttribute('aria-label','Next featured collection');previous.addEventListener('click',()=>show(active-1));next.addEventListener('click',()=>show(active+1));
  region.append(content,previous,next,dots);hero.replaceWith(region);
  const tiles=element('nav','discover-categories');tiles.setAttribute('aria-label','Shop collections');
  for(const category of categories){const tile=element('a','discover-category');tile.href=`/?category=${category.id}#collection`;tile.append(element('span','',category.icon),element('strong','',category.name));tiles.append(tile);}
  region.after(tiles);
  document.querySelector('.benefits')?.remove();
  document.querySelector('#collection h2').textContent='Discover your next favorite';
 }catch{/* Existing catalog and category controls remain usable on failure. */}
});
