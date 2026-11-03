// Uses the official Node driver, so mongosh is not required.
export async function seedMongo(db) {
  await db.collection('reviews').createIndex({ productId:1,createdAt:-1 });
  await db.collection('click_events').createIndex({ type:1,createdAt:-1 });
  await db.collection('click_events').createIndex({ productId:1 });
  await db.collection('search_logs').createIndex({ query:1,createdAt:-1 });
  const reviews = ['Lovely quality and carefully packed.','Good value. Arrived exactly as described.','A thoughtful everyday essential.'];
  const names = ['Aziza','Javohir','Madina'];
  const operations = [];
  for (let productId=1;productId<=12;productId++) for(let j=0;j<3;j++) {
    const _id=`seed-review-${productId}-${j}`;
    operations.push({updateOne:{filter:{_id},update:{$setOnInsert:{productId,author:names[j],rating:j===1?4:5,comment:reviews[j],createdAt:new Date(Date.UTC(2026,9,20+j))}},upsert:true}});
  }
  await db.collection('reviews').bulkWrite(operations);
  // Fixed IDs and timestamps make repeated setup safe and deterministic.
  for(let start=0;start<10000;start+=1000) {
    await db.collection('click_events').bulkWrite(Array.from({length:1000},(_,j)=>{
      const i=start+j;
      return {updateOne:{filter:{_id:`seed-click-${i}`},update:{$setOnInsert:{type:i%5===0?'add_to_cart':'product_view',productId:i%12+1,city:['Tashkent','Samarkand','Bukhara'][i%3],createdAt:new Date(Date.UTC(2026,9,1)+i*60000)}},upsert:true}};
    }));
  }
  await db.collection('search_logs').bulkWrite(Array.from({length:1000},(_,i)=>({updateOne:{filter:{_id:`seed-search-${i}`},update:{$setOnInsert:{type:'search',query:['silk','headphones','ceramic','backpack','mug'][i%5],createdAt:new Date(Date.UTC(2026,9,1)+i*60000)}},upsert:true}})));
}
