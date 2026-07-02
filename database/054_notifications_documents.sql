-- ============================================================
-- Phase 5+6: Notification System & Document Management
-- ============================================================

-- 1. Notifications (in-app + email preferences)
DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'both'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title_en VARCHAR(500) NOT NULL,
  title_ar VARCHAR(500),
  body_en TEXT,
  body_ar TEXT,
  type VARCHAR(50) DEFAULT 'general',
  channel notification_channel DEFAULT 'both',
  priority notification_priority DEFAULT 'normal',
  reference_type VARCHAR(50),
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may be missing if table already existed from earlier migration
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_en VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_ar VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body_en TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body_ar TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel notification_channel DEFAULT 'both';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority notification_priority DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_notifications_user_unread;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
DROP INDEX IF EXISTS idx_notifications_created;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 2. Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  notify_on_approval BOOLEAN DEFAULT true,
  notify_on_rejection BOOLEAN DEFAULT true,
  notify_on_status_change BOOLEAN DEFAULT true,
  notify_on_new_assignment BOOLEAN DEFAULT true,
  notify_on_comments BOOLEAN DEFAULT true,
  notify_on_deadline BOOLEAN DEFAULT true,
  daily_digest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. File Uploads / Document Management
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_name VARCHAR(100) DEFAULT 'documents',
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100),
  storage_path TEXT NOT NULL,
  public_url TEXT,
  uploaded_by UUID REFERENCES user_profiles(id),
  reference_type VARCHAR(50),
  reference_id UUID,
  folder VARCHAR(200) DEFAULT '/',
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Document Folders / Categories
CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  parent_id UUID REFERENCES document_folders(id),
  icon VARCHAR(50) DEFAULT 'folder',
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

-- Notifications: users see only their own
DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
-- System can insert
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "np_select" ON notification_preferences;
CREATE POLICY "np_select" ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "np_upsert" ON notification_preferences;
CREATE POLICY "np_upsert" ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "np_update" ON notification_preferences;
CREATE POLICY "np_update" ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "fu_select" ON file_uploads;
CREATE POLICY "fu_select" ON file_uploads FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "fu_insert" ON file_uploads;
CREATE POLICY "fu_insert" ON file_uploads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "fu_delete" ON file_uploads;
CREATE POLICY "fu_delete" ON file_uploads FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "df_select" ON document_folders;
CREATE POLICY "df_select" ON document_folders FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "df_insert" ON document_folders;
CREATE POLICY "df_insert" ON document_folders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "df_update" ON document_folders;
CREATE POLICY "df_update" ON document_folders FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "df_delete" ON document_folders;
CREATE POLICY "df_delete" ON document_folders FOR DELETE USING (auth.role() = 'authenticated');

-- Seed document folders
INSERT INTO document_folders (name_en, name_ar, icon) VALUES
  ('Contracts', 'العقود', 'file-text'),
  ('Invoices', 'الفواتير', 'receipt'),
  ('Reports', 'التقارير', 'bar-chart'),
  ('Photos', 'الصور', 'image'),
  ('Drawings', 'المخططات', 'hard-hat'),
  ('Certificates', 'الشهادات', 'award'),
  ('Correspondence', 'المراسلات', 'mail'),
  ('Legal', 'القانونية', 'scale')
ON CONFLICT DO NOTHING;

-- Notification function: automatically notify on status changes
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_title_en TEXT;
  v_title_ar TEXT;
  v_body_en TEXT;
  v_body_ar TEXT;
  v_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_title_en := format('Status changed: %s → %s', OLD.status, NEW.status);
    v_title_ar := format('تغيرت الحالة: %s ← %s', OLD.status, NEW.status);

    -- Try to determine the affected user
    v_user_id := COALESCE(NEW.assigned_to, NEW.requester_id, NEW.employee_id);

    IF v_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title_en, title_ar, type, reference_type, reference_id, channel)
      VALUES (v_user_id, v_title_en, v_title_ar, 'status_change', TG_TABLE_NAME, NEW.id, 'both');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
