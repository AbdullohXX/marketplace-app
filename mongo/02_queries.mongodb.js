// Run in mongosh (or a MongoDB Playground) against the seeded development DB.
// Change the database name below if MONGODB_DB differs.
use('marketplace');
// Q1 CRUD: How do we add a review? Dedicated exercise ID allows safe reruns.
db.reviews.updateOne({_id:'query-exercise'},{$setOnInsert:{productId:1,author:'Aziza',rating:5,comment:'Great quality',createdAt:new Date()}},{upsert:true});
// Q2 CRUD: What are the newest reviews for product 1?
db.reviews.find({productId:1}).sort({createdAt:-1}).limit(5);
// Q3 CRUD: How do we correct our exercise review?
db.reviews.updateOne({_id:'query-exercise'},{$set:{rating:4}});
// Q4 CRUD: How do we remove the exercise review?
db.reviews.deleteOne({_id:'query-exercise'});
// Q5 CRUD: How many product-view events exist?
db.click_events.countDocuments({type:'product_view'});
// Q6 AGGREGATION: Which products receive the most views?
db.click_events.aggregate([{$match:{type:'product_view'}},{$group:{_id:'$productId',views:{$sum:1}}},{$sort:{views:-1}},{$limit:5}]);
// Q7 AGGREGATION: What is the average rating per product?
db.reviews.aggregate([{$group:{_id:'$productId',rating:{$avg:'$rating'},reviews:{$sum:1}}},{$sort:{rating:-1}}]);
// Q8 AGGREGATION: What are the most common searches?
db.search_logs.aggregate([{$group:{_id:'$query',searches:{$sum:1}}},{$sort:{searches:-1}}]);
// Q9 AGGREGATION: How does activity vary by day?
db.click_events.aggregate([{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},events:{$sum:1}}},{$sort:{_id:1}}]);
// Q10 AGGREGATION: Which cities generate cart additions?
db.click_events.aggregate([{$match:{type:'add_to_cart'}},{$group:{_id:'$city',events:{$sum:1}}},{$sort:{events:-1}}]);
// Q11 INDEX/EXPLAIN: Does a product lookup use the productId index?
db.click_events.find({productId:1}).explain('executionStats');
// Q12 INDEX/EXPLAIN: Can the review index support filtering and date sorting?
db.reviews.find({productId:1}).sort({createdAt:-1}).explain('executionStats');
