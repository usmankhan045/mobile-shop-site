CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imei TEXT NOT NULL UNIQUE,
  secondary_imei TEXT UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  storage TEXT,
  color TEXT,
  condition TEXT NOT NULL DEFAULT 'Used',
  status TEXT NOT NULL DEFAULT 'In stock' CHECK (status IN ('In stock', 'Sold', 'Returned', 'Archived')),
  supplier_id UUID REFERENCES suppliers(id),
  seller_name TEXT,
  seller_cnic TEXT,
  customer_id UUID REFERENCES customers(id),
  purchase_price NUMERIC(12,2) NOT NULL CHECK (purchase_price >= 0),
  sale_price NUMERIC(12,2) CHECK (sale_price IS NULL OR sale_price >= 0),
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  sold_at DATE,
  notes TEXT,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS phone_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_id UUID NOT NULL REFERENCES phones(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'sale', 'return', 'adjustment', 'archive')),
  amount NUMERIC(12,2),
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phones_status_idx ON phones(status);
CREATE INDEX IF NOT EXISTS phones_brand_model_idx ON phones(brand, model);
CREATE INDEX IF NOT EXISTS phones_purchased_at_idx ON phones(purchased_at DESC);
CREATE INDEX IF NOT EXISTS phone_events_date_idx ON phone_events(event_date DESC);
CREATE INDEX IF NOT EXISTS phone_events_phone_idx ON phone_events(phone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx ON login_attempts(email, ip_address, created_at DESC);

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
