-- Refresh only the original demonstration records. Real seller rows are untouched.
BEGIN;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false;
UPDATE sellers s SET demo=true,
  slug=coalesce(s.slug,v.slug),
  description=v.description,
  appearance=jsonb_build_object('theme',v.theme,'description',v.description,'cover',v.cover)
FROM (VALUES
  (1,'tashkent-tech','Audio and desk essentials for everyday use.','forest','/assets/demo/01-headphones.jpg'),
  (2,'rishtan-studio','Ceramics and table pieces for a slower morning.','clay','/assets/demo/07-tea.jpg'),
  (3,'atlas-house','Colorful textiles and simple things to carry.','clay','/assets/demo/03-scarves.jpg'),
  (4,'samarqand-living','Useful objects for the home and the workday.','forest','/assets/demo/04-lamp.jpg'),
  (5,'bukhara-goods','Practical bags and small everyday accessories.','slate','/assets/demo/05-backpack.jpg')
) AS v(id,slug,description,theme,cover)
WHERE s.id=v.id AND NOT s.demo AND NOT EXISTS (SELECT 1 FROM shop_members m WHERE m.shop_id=s.id);
UPDATE products p SET
  name=v.name, description=v.description, media_url=v.photo,
  media_urls=jsonb_build_array(v.photo), specifications=''
FROM (VALUES
  (1,'Wireless over-ear headphones','Padded over-ear headphones pictured on a light background. Demonstration listing; features and availability are illustrative.','/assets/demo/01-headphones.jpg'),
  (2,'Cream ceramic bowl','A simple cream bowl with a smooth glaze. Demonstration listing; finish and availability are illustrative.','/assets/demo/02-bowl.jpg'),
  (3,'Patterned scarf edit','A colorful selection of patterned scarves. Demonstration listing; a real seller would specify the exact print.','/assets/demo/03-scarves.jpg'),
  (4,'White reading lamp','A compact white desk lamp shown in a calm workspace. Demonstration listing; specifications are illustrative.','/assets/demo/04-lamp.jpg'),
  (5,'Black commuter backpack','A black flap-top backpack shown outdoors. Demonstration listing; materials and availability are illustrative.','/assets/demo/05-backpack.jpg'),
  (6,'Portable Bluetooth speaker','A handheld black portable speaker. Demonstration listing; model and specifications are illustrative.','/assets/demo/06-speaker.jpg'),
  (7,'Floral teapot and cup','A floral ceramic teapot with a matching cup. Demonstration listing; the photograph illustrates the style.','/assets/demo/07-tea.jpg'),
  (8,'Coffee print canvas tote','A light canvas tote with a coffee print. Demonstration listing; size and availability are illustrative.','/assets/demo/08-bag.jpg'),
  (9,'Morning ceramic mug','A ceramic mug photographed on a wooden table. Demonstration listing; size and finish are illustrative.','/assets/demo/09-mug.jpg'),
  (10,'Brown leather card holder','A slim brown leather card wallet with several slots. Demonstration listing; materials are illustrative.','/assets/demo/10-wallet.jpg'),
  (11,'Full-size wireless keyboard','A dark wireless keyboard shown on a desk. Demonstration listing; model and specifications are illustrative.','/assets/demo/11-keyboard.jpg'),
  (12,'Blank-page notebook','An open notebook with blank pages on a wooden table. Demonstration listing; page count is illustrative.','/assets/demo/12-notebook.jpg')
) AS v(id,name,description,photo)
WHERE p.id=v.id AND p.draft_id IS NULL AND p.media_url IS NULL;
COMMIT;
