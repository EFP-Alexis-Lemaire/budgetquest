-- ============================================================
-- BudgetQuest - Schéma initial
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  level         INTEGER NOT NULL DEFAULT 1,
  xp            INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  last_active   DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BUDGETS ─────────────────────────────────────────────
CREATE TABLE budgets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          INTEGER NOT NULL CHECK (year >= 2024),
  total_income  NUMERIC(10,2) NOT NULL DEFAULT 0,
  savings_goal  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- ─── BUDGET CATEGORIES ───────────────────────────────────
CREATE TABLE budget_categories (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id        UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  allocated_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  spent_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  color            TEXT NOT NULL DEFAULT '#6366f1',
  icon             TEXT NOT NULL DEFAULT '💰',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_id   UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SAVINGS GOALS ───────────────────────────────────────
CREATE TABLE savings_goals (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  target_amount        NUMERIC(10,2) NOT NULL,
  current_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC(10,2) NOT NULL DEFAULT 0,
  months_to_goal       INTEGER,
  target_date          DATE,
  icon                 TEXT DEFAULT '🎯',
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USER BADGES ─────────────────────────────────────────
CREATE TABLE user_badges (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- ─── TRIGGERS & FUNCTIONS ────────────────────────────────

-- Mise à jour auto du spent_amount dans budget_categories
CREATE OR REPLACE FUNCTION update_category_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'expense' THEN
    UPDATE budget_categories
    SET spent_amount = spent_amount + NEW.amount
    WHERE id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'expense' THEN
    UPDATE budget_categories
    SET spent_amount = GREATEST(0, spent_amount - OLD.amount)
    WHERE id = OLD.category_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_spent
AFTER INSERT OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_category_spent();

-- Fonction pour ajouter de l'XP et gérer les niveaux
CREATE OR REPLACE FUNCTION add_xp(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
DECLARE
  current_xp   INTEGER;
  current_level INTEGER;
  new_xp       INTEGER;
  new_level    INTEGER;
  xp_needed    INTEGER;
BEGIN
  SELECT xp, level INTO current_xp, current_level FROM users WHERE id = user_id;

  new_xp := current_xp + amount;
  new_level := current_level;

  -- Vérifier si level up
  LOOP
    xp_needed := FLOOR(100 * POWER(1.5, new_level - 1));
    EXIT WHEN new_xp < xp_needed;
    new_level := new_level + 1;
  END LOOP;

  UPDATE users SET xp = new_xp, level = new_level, updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Mise à jour du updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_savings_updated_at
BEFORE UPDATE ON savings_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── INDEXES ─────────────────────────────────────────────
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_budget ON transactions(budget_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_savings_user ON savings_goals(user_id);
CREATE INDEX idx_badges_user ON user_badges(user_id);
