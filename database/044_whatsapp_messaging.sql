-- WhatsApp Messaging Integration
-- Stores inbound/outbound WhatsApp messages linked to tickets, deals, contacts

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number VARCHAR(50) NOT NULL,
  to_number VARCHAR(50) NOT NULL,
  message_body TEXT,
  media_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  whatsapp_message_id VARCHAR(255),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read whatsapp_messages" ON whatsapp_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert whatsapp_messages" ON whatsapp_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update whatsapp_messages" ON whatsapp_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete whatsapp_messages" ON whatsapp_messages FOR DELETE TO authenticated USING (true);
