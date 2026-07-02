CREATE TABLE IF NOT EXISTS translation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'ar')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, locale, key)
);

ALTER TABLE translation_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON translation_overrides
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own" ON translation_overrides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON translation_overrides
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own" ON translation_overrides
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_translation_overrides_user_locale ON translation_overrides (user_id, locale);
