Thisismyfinanace#1412
/*
================================================================================
  EXPENSO - COMPLETE DATABASE SETUP
  Version: 1.0.0

  CONTENTS:
  1.  Extensions
  2.  Core Auth & Profiles
  3.  User Preferences
  4.  Expense Categories & Expenses
  5.  Income Categories & Income
  6.  Budgets, Monthly Budgets & Budget Alerts
  7.  Goals & Wishlist
  8.  Money Jars
  9.  Gamification (Achievements, Mood Tracker)
  10. Social (Challenges, Challenge Participants)
  11. Game Suggestions & Votes
  12. Chat System (Rooms, Messages, Members)
  13. Stock Portfolio
  14. Storage Buckets
  15. Row Level Security (RLS) Policies
  16. Indexes
  17. Views
  18. Seed Data (default income categories)
  19. Auth Email Templates (as comments with HTML)
================================================================================
*/


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 2. CORE AUTH & PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  username      TEXT UNIQUE,
  avatar_url    TEXT,
  bio           TEXT,
  occupation    TEXT,
  xp            INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  health_score  INTEGER NOT NULL DEFAULT 75,
  last_active   TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. USER PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  currency_code              TEXT NOT NULL DEFAULT 'INR',
  stock_disclaimer_accepted  BOOLEAN NOT NULL DEFAULT false,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. EXPENSE CATEGORIES & EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#FF6B6B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: one expense can belong to multiple categories
CREATE TABLE IF NOT EXISTS expense_category_mappings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (expense_id, category_id)
);


-- ============================================================
-- 5. INCOME CATEGORIES & INCOME
-- ============================================================

CREATE TABLE IF NOT EXISTS income_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS income (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  in_hand_amount  NUMERIC(12, 2),
  description     TEXT NOT NULL DEFAULT '',
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id     UUID REFERENCES income_categories(id) ON DELETE SET NULL,
  is_holiday      BOOLEAN NOT NULL DEFAULT false,
  holiday_type    TEXT CHECK (holiday_type IN ('leave', 'festival')),
  holiday_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 6. BUDGETS, MONTHLY BUDGETS & BUDGET ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS budgets (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id            UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  amount                 NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  spent                  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  month                  DATE NOT NULL,
  notification_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.75 CHECK (notification_threshold BETWEEN 0 AND 1),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month      DATE NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id    UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('warning', 'exceeded', 'approaching', 'monthly_exceeded')),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 7. GOALS & WISHLIST
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  target_amount  NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deadline       DATE,
  completed      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  price         NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  added_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  can_buy_date  TIMESTAMPTZ NOT NULL,
  reflection    TEXT,
  reviewed      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 8. MONEY JARS
-- ============================================================

CREATE TABLE IF NOT EXISTS money_jars (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_amount  NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  color          TEXT NOT NULL DEFAULT '#FF6B6BCC',
  icon           TEXT NOT NULL DEFAULT 'PiggyBank',
  position_x     INTEGER NOT NULL DEFAULT 100,
  position_y     INTEGER NOT NULL DEFAULT 100,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 9. GAMIFICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified    BOOLEAN NOT NULL DEFAULT false,
  shared      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS mood_tracker (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood    TEXT NOT NULL CHECK (mood IN ('happy','neutral','sad','stressed','excited','tired','Motivated','Grateful','Energetic')),
  date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);


-- ============================================================
-- 10. SOCIAL CHALLENGES
-- ============================================================

CREATE TABLE IF NOT EXISTS challenges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  type              TEXT NOT NULL CHECK (type IN ('savings', 'spending_limit', 'streak', 'custom')),
  target_amount     NUMERIC(12, 2),
  duration_days     INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  xp_reward         INTEGER NOT NULL DEFAULT 50,
  max_participants  INTEGER,
  entry_fee         NUMERIC(12, 2),
  is_public         BOOLEAN NOT NULL DEFAULT true,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  ends_at           TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress     NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed    BOOLEAN NOT NULL DEFAULT false,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);


-- ============================================================
-- 11. GAME SUGGESTIONS & VOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS game_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suggestion_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES game_suggestions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);


-- ============================================================
-- 12. CHAT SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  is_private  BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  reply_to     UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  is_edited    BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);


-- ============================================================
-- 13. STOCK PORTFOLIO
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_portfolio (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol         TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  quantity       NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
  purchase_price NUMERIC(12, 4) NOT NULL CHECK (purchase_price > 0),
  purchase_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 14. STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 15. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences          ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE income                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_jars                ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_tracker              ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges                ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_suggestions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_portfolio           ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Leaderboard: all authenticated users can view any profile (for rankings)
CREATE POLICY "Authenticated users can view all profiles for leaderboard"
  ON profiles FOR SELECT TO authenticated
  USING (true);

-- ---- USER PREFERENCES ----
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- EXPENSE CATEGORIES ----
CREATE POLICY "Users can view own expense categories"
  ON expense_categories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense categories"
  ON expense_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expense categories"
  ON expense_categories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense categories"
  ON expense_categories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- EXPENSES ----
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- EXPENSE CATEGORY MAPPINGS ----
CREATE POLICY "Users can view own expense category mappings"
  ON expense_category_mappings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expense category mappings"
  ON expense_category_mappings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expense category mappings"
  ON expense_category_mappings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- INCOME CATEGORIES ----
CREATE POLICY "Users can view own income categories"
  ON income_categories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income categories"
  ON income_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income categories"
  ON income_categories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own income categories"
  ON income_categories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- INCOME ----
CREATE POLICY "Users can view own income"
  ON income FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income"
  ON income FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income"
  ON income FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own income"
  ON income FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- BUDGETS ----
CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- MONTHLY BUDGETS ----
CREATE POLICY "Users can view own monthly budgets"
  ON monthly_budgets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly budgets"
  ON monthly_budgets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly budgets"
  ON monthly_budgets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly budgets"
  ON monthly_budgets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- BUDGET ALERTS ----
CREATE POLICY "Users can view own budget alerts"
  ON budget_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget alerts"
  ON budget_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget alerts"
  ON budget_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget alerts"
  ON budget_alerts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- GOALS ----
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- WISHLIST ----
CREATE POLICY "Users can view own wishlist"
  ON wishlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist"
  ON wishlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wishlist"
  ON wishlist FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist"
  ON wishlist FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- MONEY JARS ----
CREATE POLICY "Users can view own money jars"
  ON money_jars FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own money jars"
  ON money_jars FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own money jars"
  ON money_jars FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own money jars"
  ON money_jars FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- ACHIEVEMENTS ----
CREATE POLICY "Users can view own achievements"
  ON achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON achievements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- MOOD TRACKER ----
CREATE POLICY "Users can view own mood entries"
  ON mood_tracker FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood entries"
  ON mood_tracker FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mood entries"
  ON mood_tracker FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- CHALLENGES ----
CREATE POLICY "Authenticated users can view public challenges and own challenges"
  ON challenges FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create challenges"
  ON challenges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own challenges"
  ON challenges FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete own challenges"
  ON challenges FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ---- CHALLENGE PARTICIPANTS ----
CREATE POLICY "Participants can view challenge participation"
  ON challenge_participants FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM challenges
      WHERE challenges.id = challenge_id
      AND (challenges.is_public = true OR challenges.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
  ON challenge_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave challenges"
  ON challenge_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- GAME SUGGESTIONS ----
CREATE POLICY "Authenticated users can view all suggestions"
  ON game_suggestions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create suggestions"
  ON game_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = suggested_by);

CREATE POLICY "Creators can delete own suggestions"
  ON game_suggestions FOR DELETE TO authenticated
  USING (auth.uid() = suggested_by);

-- ---- SUGGESTION VOTES ----
CREATE POLICY "Authenticated users can view all votes"
  ON suggestion_votes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can cast votes"
  ON suggestion_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change own vote"
  ON suggestion_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
  ON suggestion_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- CHAT ROOMS ----
CREATE POLICY "Public rooms are visible to all authenticated users"
  ON chat_rooms FOR SELECT TO authenticated
  USING (
    is_private = false OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = id
      AND room_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create chat rooms"
  ON chat_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms"
  ON chat_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can delete their rooms"
  ON chat_rooms FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ---- CHAT MESSAGES ----
CREATE POLICY "Room members can view messages"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = chat_messages.room_id
      AND room_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Room members can send messages"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = chat_messages.room_id
      AND room_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit own messages"
  ON chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- ROOM MEMBERS ----
CREATE POLICY "Room members can view membership"
  ON room_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = room_id
      AND chat_rooms.is_private = false
    )
  );

CREATE POLICY "Users can join public rooms"
  ON room_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON room_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- STOCK PORTFOLIO ----
CREATE POLICY "Users can view own portfolio"
  ON stock_portfolio FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own portfolio"
  ON stock_portfolio FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio"
  ON stock_portfolio FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from own portfolio"
  ON stock_portfolio FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---- STORAGE: AVATARS BUCKET ----
CREATE POLICY "Avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- 16. INDEXES (Performance)
-- ============================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp DESC);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_id    ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date  ON expenses(user_id, date DESC);

-- Expense category mappings
CREATE INDEX IF NOT EXISTS idx_ecm_expense_id  ON expense_category_mappings(expense_id);
CREATE INDEX IF NOT EXISTS idx_ecm_category_id ON expense_category_mappings(category_id);
CREATE INDEX IF NOT EXISTS idx_ecm_user_id     ON expense_category_mappings(user_id);

-- Income
CREATE INDEX IF NOT EXISTS idx_income_user_id   ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_income_date      ON income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_user_date ON income(user_id, date DESC);

-- Budgets
CREATE INDEX IF NOT EXISTS idx_budgets_user_id         ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_month  ON budgets(category_id, month);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month      ON budgets(user_id, month);

-- Budget alerts
CREATE INDEX IF NOT EXISTS idx_budget_alerts_user_id      ON budget_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_unacknowledged ON budget_alerts(user_id, acknowledged) WHERE acknowledged = false;

-- Goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- Money jars
CREATE INDEX IF NOT EXISTS idx_money_jars_user_id ON money_jars(user_id);

-- Achievements
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);

-- Mood tracker
CREATE INDEX IF NOT EXISTS idx_mood_tracker_user_date ON mood_tracker(user_id, date DESC);

-- Challenges
CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);
CREATE INDEX IF NOT EXISTS idx_challenges_status      ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_is_public   ON challenges(is_public);

-- Challenge participants
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user      ON challenge_participants(user_id);

-- Game suggestions
CREATE INDEX IF NOT EXISTS idx_game_suggestions_suggested_by ON game_suggestions(suggested_by);

-- Suggestion votes
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion ON suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user       ON suggestion_votes(user_id);

-- Chat rooms
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);

-- Chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id   ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id   ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_date ON chat_messages(room_id, created_at DESC);

-- Room members
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);

-- Stock portfolio
CREATE INDEX IF NOT EXISTS idx_stock_portfolio_user_id ON stock_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_portfolio_symbol  ON stock_portfolio(user_id, symbol);


-- ============================================================
-- 17. VIEWS
-- ============================================================

-- Game suggestions with aggregated vote counts
CREATE OR REPLACE VIEW game_suggestions_with_votes AS
SELECT
  gs.*,
  p.first_name,
  p.last_name,
  COALESCE(
    SUM(CASE WHEN sv.vote_type = 'up' THEN 1 ELSE 0 END), 0
  ) AS upvotes,
  COALESCE(
    SUM(CASE WHEN sv.vote_type = 'down' THEN 1 ELSE 0 END), 0
  ) AS downvotes,
  COALESCE(
    SUM(CASE WHEN sv.vote_type = 'up' THEN 1 WHEN sv.vote_type = 'down' THEN -1 ELSE 0 END), 0
  ) AS net_votes
FROM game_suggestions gs
LEFT JOIN suggestion_votes sv ON sv.suggestion_id = gs.id
LEFT JOIN profiles p ON p.id = gs.suggested_by
GROUP BY gs.id, p.first_name, p.last_name;

-- Leaderboard view (top users by XP)
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  id,
  first_name,
  last_name,
  username,
  avatar_url,
  xp,
  level,
  health_score
FROM profiles
ORDER BY xp DESC;

-- Monthly expense summary per user
CREATE OR REPLACE VIEW monthly_expense_summary AS
SELECT
  e.user_id,
  DATE_TRUNC('month', e.date) AS month,
  SUM(e.amount) AS total_expenses,
  COUNT(*) AS transaction_count
FROM expenses e
GROUP BY e.user_id, DATE_TRUNC('month', e.date);

-- Monthly income summary per user
CREATE OR REPLACE VIEW monthly_income_summary AS
SELECT
  i.user_id,
  DATE_TRUNC('month', i.date) AS month,
  SUM(COALESCE(i.in_hand_amount, i.amount)) AS total_income,
  COUNT(*) FILTER (WHERE NOT i.is_holiday) AS income_entries,
  COUNT(*) FILTER (WHERE i.is_holiday AND i.holiday_type = 'leave') AS leave_days
FROM income i
GROUP BY i.user_id, DATE_TRUNC('month', i.date);


-- ============================================================
-- 18. SEED DATA
-- ============================================================

-- NOTE: These default income categories are created for each new user
-- via application logic. Here we create a helper function instead.

CREATE OR REPLACE FUNCTION create_default_income_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO income_categories (user_id, name) VALUES
    (p_user_id, 'Salary'),
    (p_user_id, 'Freelance'),
    (p_user_id, 'Business'),
    (p_user_id, 'Investment'),
    (p_user_id, 'Rental'),
    (p_user_id, 'Gift'),
    (p_user_id, 'Other')
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION create_default_expense_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO expense_categories (user_id, name, color) VALUES
    (p_user_id, 'Food & Dining',   '#FF6B6B'),
    (p_user_id, 'Transport',       '#4ECDC4'),
    (p_user_id, 'Shopping',        '#45B7D1'),
    (p_user_id, 'Entertainment',   '#96CEB4'),
    (p_user_id, 'Utilities',       '#FFEAA7'),
    (p_user_id, 'Health',          '#DDA0DD'),
    (p_user_id, 'Rent',            '#98D8C8'),
    (p_user_id, 'Education',       '#F7DC6F'),
    (p_user_id, 'Travel',          '#BB8FCE'),
    (p_user_id, 'Other',           '#85C1E9')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Extend handle_new_user to also create defaults
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default user preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default categories
  PERFORM create_default_income_categories(NEW.id);
  PERFORM create_default_expense_categories(NEW.id);

  RETURN NEW;
END;
$$;


-- ============================================================
-- 19. AUTH EMAIL TEMPLATES
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard > Authentication > Email Templates
-- 2. Select the template type (Confirm signup, Reset Password, etc.)
-- 3. Toggle "Enable custom email" if needed
-- 4. Copy the HTML from the section below into the template editor
-- 5. Save the template
--
-- Available template variables:
--   {{ .ConfirmationURL }} - The magic link / confirmation URL
--   {{ .Email }}           - Recipient email address
--   {{ .SiteURL }}         - Your site URL (set in Auth settings)
--   {{ .Token }}           - Raw OTP token (for OTP flows)
-- ============================================================


/*
------------------------------------------------------------
TEMPLATE 1: CONFIRM SIGNUP (Email Confirmation)
Subject: Confirm your Expenso account
------------------------------------------------------------

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirm your Expenso account</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Manrope', Helvetica, Arial, sans-serif;
      background-color: #f5f5f5;
      color: #111;
      padding: 40px 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background-color: #FFCC00;
      padding: 36px 40px 28px;
      text-align: center;
      border-bottom: 3px solid #000;
    }
    .logo {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -1px;
      color: #000;
    }
    .logo span { color: #000; }
    .tagline {
      font-size: 13px;
      color: #333;
      margin-top: 6px;
      font-weight: 500;
    }
    .body { padding: 40px; }
    .greeting {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #111;
    }
    .message {
      font-size: 15px;
      color: #444;
      line-height: 1.7;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      background: #FFCC00;
      color: #000;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 8px;
      text-decoration: none;
      border: 2px solid #000;
      transition: background 0.2s;
    }
    .btn:hover { background: #e6b800; }
    .divider {
      border: none;
      border-top: 1px solid #eee;
      margin: 36px 0;
    }
    .link-fallback {
      font-size: 13px;
      color: #666;
      line-height: 1.6;
      word-break: break-all;
    }
    .link-fallback a { color: #111; font-weight: 600; }
    .footer {
      background: #111;
      padding: 24px 40px;
      text-align: center;
    }
    .footer p {
      color: #aaa;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer a { color: #FFCC00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">EX<span>PENSO</span></div>
      <p class="tagline">Smart Expense Tracker</p>
    </div>
    <div class="body">
      <p class="greeting">Confirm your account</p>
      <p class="message">
        Welcome to Expenso! You are just one click away from taking control of your finances.
        Click the button below to confirm your email address and activate your account.
      </p>
      <a href="{{ .ConfirmationURL }}" class="btn">Confirm Email Address</a>
      <hr class="divider" />
      <p class="link-fallback">
        If the button does not work, copy and paste this link into your browser:<br/>
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </p>
      <hr class="divider" />
      <p class="link-fallback">
        If you did not create an account with Expenso, please ignore this email.
        This link expires in 24 hours.
      </p>
    </div>
    <div class="footer">
      <p>
        &copy; 2025 Expenso &mdash; Built with care by Akshat Pandey<br/>
        <a href="{{ .SiteURL }}/privacy">Privacy Policy</a> &bull;
        <a href="{{ .SiteURL }}/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>


------------------------------------------------------------
TEMPLATE 2: RESET PASSWORD
Subject: Reset your Expenso password
------------------------------------------------------------

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your Expenso password</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Manrope', Helvetica, Arial, sans-serif;
      background-color: #f5f5f5;
      color: #111;
      padding: 40px 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background-color: #FFCC00;
      padding: 36px 40px 28px;
      text-align: center;
      border-bottom: 3px solid #000;
    }
    .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; color: #000; }
    .tagline { font-size: 13px; color: #333; margin-top: 6px; font-weight: 500; }
    .body { padding: 40px; }
    .icon {
      width: 56px;
      height: 56px;
      background: #fff7cc;
      border: 2px solid #FFCC00;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      font-size: 26px;
    }
    .greeting { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111; }
    .message { font-size: 15px; color: #444; line-height: 1.7; margin-bottom: 32px; }
    .btn {
      display: inline-block;
      background: #111;
      color: #FFCC00;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 8px;
      text-decoration: none;
      border: 2px solid #000;
    }
    .warning-box {
      background: #fff7cc;
      border: 1px solid #FFCC00;
      border-radius: 8px;
      padding: 16px;
      margin-top: 28px;
      font-size: 13px;
      color: #555;
      line-height: 1.6;
    }
    .divider { border: none; border-top: 1px solid #eee; margin: 28px 0; }
    .link-fallback { font-size: 13px; color: #666; line-height: 1.6; word-break: break-all; }
    .link-fallback a { color: #111; font-weight: 600; }
    .footer { background: #111; padding: 24px 40px; text-align: center; }
    .footer p { color: #aaa; font-size: 12px; line-height: 1.6; }
    .footer a { color: #FFCC00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">EXPENSO</div>
      <p class="tagline">Smart Expense Tracker</p>
    </div>
    <div class="body">
      <p class="greeting">Reset your password</p>
      <p class="message">
        We received a request to reset the password for your Expenso account
        associated with <strong>{{ .Email }}</strong>.<br/><br/>
        Click the button below to create a new password. This link is valid for
        <strong>1 hour</strong>.
      </p>
      <a href="{{ .ConfirmationURL }}" class="btn">Reset My Password</a>
      <div class="warning-box">
        <strong>Did not request this?</strong><br/>
        If you did not request a password reset, please ignore this email.
        Your password will remain unchanged and your account is safe.
      </div>
      <hr class="divider" />
      <p class="link-fallback">
        If the button does not work, paste this into your browser:<br/>
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </p>
    </div>
    <div class="footer">
      <p>
        &copy; 2025 Expenso &mdash; Built with care by Akshat Pandey<br/>
        <a href="{{ .SiteURL }}/privacy">Privacy Policy</a> &bull;
        <a href="{{ .SiteURL }}/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>


------------------------------------------------------------
TEMPLATE 3: MAGIC LINK (Passwordless Login)
Subject: Your Expenso login link
------------------------------------------------------------

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Expenso login link</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Manrope', Helvetica, Arial, sans-serif;
      background-color: #f5f5f5;
      color: #111;
      padding: 40px 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background-color: #FFCC00;
      padding: 36px 40px 28px;
      text-align: center;
      border-bottom: 3px solid #000;
    }
    .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; color: #000; }
    .tagline { font-size: 13px; color: #333; margin-top: 6px; font-weight: 500; }
    .body { padding: 40px; }
    .greeting { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111; }
    .message { font-size: 15px; color: #444; line-height: 1.7; margin-bottom: 32px; }
    .btn {
      display: inline-block;
      background: #FFCC00;
      color: #000;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 8px;
      text-decoration: none;
      border: 2px solid #000;
    }
    .expiry-notice {
      margin-top: 24px;
      padding: 14px 16px;
      background: #f9f9f9;
      border-left: 4px solid #FFCC00;
      font-size: 13px;
      color: #555;
      border-radius: 4px;
    }
    .divider { border: none; border-top: 1px solid #eee; margin: 28px 0; }
    .link-fallback { font-size: 13px; color: #666; line-height: 1.6; word-break: break-all; }
    .link-fallback a { color: #111; font-weight: 600; }
    .footer { background: #111; padding: 24px 40px; text-align: center; }
    .footer p { color: #aaa; font-size: 12px; line-height: 1.6; }
    .footer a { color: #FFCC00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">EXPENSO</div>
      <p class="tagline">Smart Expense Tracker</p>
    </div>
    <div class="body">
      <p class="greeting">Your login link is ready</p>
      <p class="message">
        Click the button below to sign in to your Expenso account.
        No password needed &mdash; this link does the work for you.
      </p>
      <a href="{{ .ConfirmationURL }}" class="btn">Sign In to Expenso</a>
      <div class="expiry-notice">
        This link expires in <strong>1 hour</strong> and can only be used once.
      </div>
      <hr class="divider" />
      <p class="link-fallback">
        If the button does not work, paste this into your browser:<br/>
        <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
      </p>
      <hr class="divider" />
      <p class="link-fallback">
        If you did not try to sign in to Expenso, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>
        &copy; 2025 Expenso &mdash; Built with care by Akshat Pandey<br/>
        <a href="{{ .SiteURL }}/privacy">Privacy Policy</a> &bull;
        <a href="{{ .SiteURL }}/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>


------------------------------------------------------------
TEMPLATE 4: EMAIL CHANGE CONFIRMATION
Subject: Confirm your new Expenso email address
------------------------------------------------------------

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Confirm your new email</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Manrope', Helvetica, Arial, sans-serif;
      background-color: #f5f5f5;
      color: #111;
      padding: 40px 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background-color: #FFCC00;
      padding: 36px 40px 28px;
      text-align: center;
      border-bottom: 3px solid #000;
    }
    .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; color: #000; }
    .tagline { font-size: 13px; color: #333; margin-top: 6px; font-weight: 500; }
    .body { padding: 40px; }
    .greeting { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111; }
    .message { font-size: 15px; color: #444; line-height: 1.7; margin-bottom: 32px; }
    .btn {
      display: inline-block;
      background: #FFCC00;
      color: #000;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 8px;
      text-decoration: none;
      border: 2px solid #000;
    }
    .divider { border: none; border-top: 1px solid #eee; margin: 28px 0; }
    .link-fallback { font-size: 13px; color: #666; line-height: 1.6; word-break: break-all; }
    .link-fallback a { color: #111; font-weight: 600; }
    .footer { background: #111; padding: 24px 40px; text-align: center; }
    .footer p { color: #aaa; font-size: 12px; line-height: 1.6; }
    .footer a { color: #FFCC00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">EXPENSO</div>
      <p class="tagline">Smart Expense Tracker</p>
    </div>
    <div class="body">
      <p class="greeting">Confirm your new email</p>
      <p class="message">
        You requested to change the email address on your Expenso account
        to <strong>{{ .Email }}</strong>.<br/><br/>
        Click the button below to confirm this change.
      </p>
      <a href="{{ .ConfirmationURL }}" class="btn">Confirm New Email</a>
      <hr class="divider" />
      <p class="link-fallback">
        If you did not request this change, please contact us immediately at
        <a href="mailto:appquery.team@gmail.com">appquery.team@gmail.com</a>
      </p>
    </div>
    <div class="footer">
      <p>
        &copy; 2025 Expenso &mdash; Built with care by Akshat Pandey<br/>
        <a href="{{ .SiteURL }}/privacy">Privacy Policy</a> &bull;
        <a href="{{ .SiteURL }}/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
*/


-- ============================================================
-- END OF EXPENSO COMPLETE DATABASE SETUP
-- ============================================================
