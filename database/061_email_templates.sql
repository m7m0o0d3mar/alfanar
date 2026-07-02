CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  subject_en TEXT NOT NULL,
  subject_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_all" ON email_templates FOR SELECT USING (true);
CREATE POLICY "templates_insert_admin" ON email_templates FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "templates_update_admin" ON email_templates FOR UPDATE USING (is_admin());
CREATE POLICY "templates_delete_admin" ON email_templates FOR DELETE USING (is_admin());

INSERT INTO email_templates (code, name_en, name_ar, subject_en, subject_ar, body_en, body_ar, variables) VALUES
('approval_request', 'Approval Request', 'طلب موافقة',
 '{{requester}} sent you an approval request: {{title}}',
 '{{requester}} أرسل لك طلب موافقة: {{title}}',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>Approval Request</h2><p><strong>{{requester}}</strong> sent you a request that needs your approval.</p><h3>{{title}}</h3><p>{{description}}</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">Review Request</a></p></body></html>',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>طلب موافقة</h2><p>أرسل <strong>{{requester}}</strong> طلباً يحتاج موافقتك.</p><h3>{{title}}</h3><p>{{description}}</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">مراجعة الطلب</a></p></body></html>',
 ARRAY['requester', 'title', 'description', 'link'])
ON CONFLICT (code) DO NOTHING;

INSERT INTO email_templates (code, name_en, name_ar, subject_en, subject_ar, body_en, body_ar, variables) VALUES
('status_change', 'Status Change Notification', 'إشعار تغيير الحالة',
 '{{entity_type}} #{{reference}} status changed to {{new_status}}',
 'تغيرت حالة {{entity_type}} #{{reference}} إلى {{new_status}}',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>Status Update</h2><p>The status of <strong>{{entity_type}} #{{reference}}</strong> has changed.</p><p><strong>From:</strong> {{old_status}}<br><strong>To:</strong> {{new_status}}</p><p>{{description}}</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">View Details</a></p></body></html>',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>تحديث الحالة</h2><p>تغيرت حالة <strong>{{entity_type}} #{{reference}}</strong>.</p><p><strong>من:</strong> {{old_status}}<br><strong>إلى:</strong> {{new_status}}</p><p>{{description}}</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">عرض التفاصيل</a></p></body></html>',
 ARRAY['entity_type', 'reference', 'old_status', 'new_status', 'description', 'link'])
ON CONFLICT (code) DO NOTHING;

INSERT INTO email_templates (code, name_en, name_ar, subject_en, subject_ar, body_en, body_ar, variables) VALUES
('password_reset', 'Password Reset', 'إعادة تعيين كلمة المرور',
 'Reset your ERP password',
 'إعادة تعيين كلمة مرور النظام',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>Password Reset</h2><p>You have requested to reset your password.</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">Reset Password</a></p><p>If you did not request this, please ignore this email.</p></body></html>',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>إعادة تعيين كلمة المرور</h2><p>لقد طلبت إعادة تعيين كلمة المرور الخاصة بك.</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">إعادة تعيين كلمة المرور</a></p><p>إذا لم تكن قد طلبت ذلك، يرجى تجاهل هذه الرسالة.</p></body></html>',
 ARRAY['link'])
ON CONFLICT (code) DO NOTHING;

INSERT INTO email_templates (code, name_en, name_ar, subject_en, subject_ar, body_en, body_ar, variables) VALUES
('welcome', 'Welcome Email', 'بريد الترحيب',
 'Welcome to the ERP System, {{name}}',
 'مرحباً بك في النظام {{name}}',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>Welcome {{name}}!</h2><p>Your account has been created. You can now access the ERP system.</p><p><strong>Email:</strong> {{email}}<br><strong>Role:</strong> {{role}}</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">Go to Dashboard</a></p></body></html>',
 '<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h2>مرحباً {{name}}!</h2><p>تم إنشاء حسابك. يمكنك الآن الوصول إلى النظام.</p><p><strong>البريد الإلكتروني:</strong> {{email}}<br><strong>الدور:</strong> {{role}}</p><p style="margin-top:20px"><a href="{{link}}" style="background:#1a73e8;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">الذهاب إلى لوحة التحكم</a></p></body></html>',
 ARRAY['name', 'email', 'role', 'link'])
ON CONFLICT (code) DO NOTHING;
