-- Register Notifications page in page_registry

INSERT INTO page_registry (code, path, name_en, name_ar, icon, sort_order, is_enabled, require_module, is_admin)
VALUES ('notifications', '/notifications', 'Notifications', 'الإشعارات', 'Bell', 25, true, NULL, false)
ON CONFLICT (code) DO NOTHING;

-- Create notification_preferences table if not exists
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  notify_on_approval BOOLEAN DEFAULT true,
  notify_on_rejection BOOLEAN DEFAULT true,
  notify_on_status_change BOOLEAN DEFAULT true,
  notify_on_new_assignment BOOLEAN DEFAULT true,
  notify_on_comments BOOLEAN DEFAULT true,
  notify_on_deadline BOOLEAN DEFAULT true,
  daily_digest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notification prefs select" ON notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Notification prefs upsert" ON notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Notification prefs update" ON notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());
