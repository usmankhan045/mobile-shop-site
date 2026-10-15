INSERT INTO suppliers (name) SELECT 'Saad Traders' WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Saad Traders');
INSERT INTO suppliers (name) SELECT 'Tech Link' WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Tech Link');
INSERT INTO suppliers (name) SELECT 'City Mobiles' WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'City Mobiles');
INSERT INTO suppliers (name) SELECT 'Mobile Hub' WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Mobile Hub');

INSERT INTO phones (imei, brand, model, condition, status, supplier_id, purchase_price, sale_price, purchased_at, sold_at)
SELECT v.imei, v.brand, v.model, 'Used', v.status, s.id, v.purchase_price, v.sale_price, v.purchased_at::date, v.sold_at::date
FROM (VALUES
  ('356789104522130','Apple','iPhone 15 Pro','Sold',214000,247000,'2024-06-18','2024-06-20','Saad Traders'),
  ('353918116098745','Samsung','Galaxy S24 Ultra','In stock',198500,NULL,'2024-06-21',NULL,'Tech Link'),
  ('359225781340116','Google','Pixel 8 Pro','Sold',168000,186000,'2024-06-15','2024-06-19','City Mobiles'),
  ('354447108381902','Apple','iPhone 14','In stock',153000,NULL,'2024-06-19',NULL,'Saad Traders'),
  ('861234056789012','OnePlus','OnePlus 12','In stock',142000,NULL,'2024-06-17',NULL,'Tech Link'),
  ('356481112209384','Samsung','Galaxy Z Flip5','Sold',165000,182000,'2024-06-12','2024-06-18','Mobile Hub')
) AS v(imei, brand, model, status, purchase_price, sale_price, purchased_at, sold_at, supplier_name)
JOIN suppliers s ON s.name = v.supplier_name
WHERE NOT EXISTS (SELECT 1 FROM phones p WHERE p.imei = v.imei);

INSERT INTO phone_events (phone_id, event_type, amount, event_date, metadata)
SELECT p.id, 'purchase', p.purchase_price, p.purchased_at, jsonb_build_object('seed', true)
FROM phones p
WHERE NOT EXISTS (SELECT 1 FROM phone_events e WHERE e.phone_id = p.id AND e.event_type = 'purchase');

INSERT INTO phone_events (phone_id, event_type, amount, event_date, metadata)
SELECT p.id, 'sale', p.sale_price, p.sold_at, jsonb_build_object('seed', true)
FROM phones p
WHERE p.sale_price IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM phone_events e WHERE e.phone_id = p.id AND e.event_type = 'sale');
