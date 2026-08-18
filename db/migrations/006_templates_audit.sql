-- ============================================================
-- MESSAGE_TEMPLATES - plantillas HSM aprobadas por Meta
-- ============================================================
CREATE TABLE message_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    meta_template_name  VARCHAR(255) NOT NULL,
    category            VARCHAR(20) NOT NULL
                            CHECK (category IN ('utility','marketing','authentication')),
    language            VARCHAR(10) NOT NULL DEFAULT 'es',
    approval_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (approval_status IN ('pending','approved','rejected')),
    body_text           TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, meta_template_name, language)
);

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(100),
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (filename) VALUES ('006_templates_audit.sql') ON CONFLICT DO NOTHING;
