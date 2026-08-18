-- ============================================================
-- CONTACTS - usuarios finales de WhatsApp
-- ============================================================
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wa_id           VARCHAR(30) NOT NULL,
    display_name    VARCHAR(255),
    opt_in          BOOLEAN NOT NULL DEFAULT true,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, wa_id)
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status              VARCHAR(20) NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','pending_human','closed')),
    assigned_agent_id   UUID REFERENCES users(id),
    ai_enabled          BOOLEAN NOT NULL DEFAULT true,
    last_inbound_at     TIMESTAMPTZ,
    window_expires_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_tenant ON conversations (tenant_id);

-- ============================================================
-- MESSAGES - log completo de la conversacion
-- ============================================================
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction           VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
    sender_type         VARCHAR(15) NOT NULL
                            CHECK (sender_type IN ('end_user','ai','human_agent','system')),
    content             TEXT,
    message_type        VARCHAR(20) NOT NULL DEFAULT 'text',
    whatsapp_message_id VARCHAR(100) UNIQUE,
    delivery_status     VARCHAR(20) DEFAULT 'sent'
                            CHECK (delivery_status IN ('sent','delivered','read','failed')),
    tool_calls          JSONB,
    tokens_input        INT,
    tokens_output       INT,
    latency_ms          INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON messages (tenant_id);

INSERT INTO schema_migrations (filename) VALUES ('005_contacts_conversations_messages.sql') ON CONFLICT DO NOTHING;
