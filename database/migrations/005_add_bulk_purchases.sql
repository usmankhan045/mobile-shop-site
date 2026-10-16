CREATE TABLE IF NOT EXISTS bulk_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bulk_purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_purchase_id UUID NOT NULL REFERENCES bulk_purchases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulk_purchases_purchased_at_idx ON bulk_purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS bulk_purchase_events_date_idx ON bulk_purchase_events(event_date DESC);
