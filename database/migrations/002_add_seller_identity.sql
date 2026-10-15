ALTER TABLE phones ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS seller_cnic TEXT;

UPDATE phones
SET seller_name = s.name
FROM suppliers s
WHERE phones.supplier_id = s.id
  AND phones.seller_name IS NULL;

DROP VIEW IF EXISTS phone_history;

CREATE VIEW phone_history AS
SELECT
  p.id,
  p.imei,
  p.secondary_imei,
  p.brand,
  p.model,
  p.storage,
  p.color,
  p.condition,
  p.status,
  p.purchase_price,
  p.sale_price,
  to_char(p.purchased_at, 'YYYY-MM-DD') AS purchased_at,
  to_char(p.sold_at, 'YYYY-MM-DD') AS sold_at,
  p.supplier_id,
  s.name AS supplier_name,
  p.seller_name,
  p.seller_cnic,
  p.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  p.notes,
  p.created_at,
  p.updated_at
FROM phones p
LEFT JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN customers c ON c.id = p.customer_id;
