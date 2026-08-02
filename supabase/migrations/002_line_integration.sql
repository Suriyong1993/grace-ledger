-- 002_line_integration.sql
-- LINE user mapping + source tracking for AI Expense Tracker

-- LINE user mapping
CREATE TABLE IF NOT EXISTS line_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  linked_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_line_users_line_id ON line_users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_users_church ON line_users(church_id);

-- Add source tracking to existing tables (non-breaking)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS line_message_id VARCHAR(255);
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS line_message_id VARCHAR(255);

-- RLS
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Church-scoped access" ON line_users;
CREATE POLICY "Church-scoped access" ON line_users
  USING (church_id IN (SELECT church_id FROM users WHERE auth_user_id = auth.uid()));
