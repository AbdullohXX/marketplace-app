// Keep indexes and remove only the generated demonstration events/reviews.
export async function seedMongo(db) {
  await db.collection('reviews').createIndex({ productId:1,createdAt:-1 });
  await db.collection('click_events').createIndex({ type:1,createdAt:-1 });
  await db.collection('click_events').createIndex({ productId:1 });
  await db.collection('search_logs').createIndex({ query:1,createdAt:-1 });
  for (const collection of ['reviews','click_events','search_logs']) {
    await db.collection(collection).deleteMany({ _id: /^seed-(review|click|search)-/ });
  }
}
