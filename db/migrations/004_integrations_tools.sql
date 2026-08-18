-- ============================================================
-- TENANT_INTEGRATIONS - conectores a sistemas dinamicos del cliente
-- ============================================================
CREATE TABLE tenant_integrations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    integration_type        VARCHAR(20) NOT NULL
                                CHECK (integration_type IN ('rest_api','graphql','db_readonly','webhook')),
    base_url                TEXT,
    auth_type               VARCHAR(20) NOT NULL DEFAULT 'api_key'
                                CHECK (auth_type IN ('api_key','bearer_token','oauth2','basic')),
    credentials_encrypted   TEXT NOT NULL,   -- cifrado en la app (CryptoService), nunca texto plano
    openapi_schema          JSONB,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','inactive','error')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AI_TOOLS - definicion de function-calling expuesta al LLM
-- ============================================================
CREATE TABLE ai_tools (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_id      UUID REFERENCES tenant_integrations(id) ON DELETE SET NULL,
    tool_name           VARCHAR(100) NOT NULL,
    description         TEXT NOT NULL,
    json_schema         JSONB NOT NULL,
    endpoint_path       TEXT,
    http_method         VARCHAR(10) DEFAULT 'GET',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, tool_name)
);

INSERT INTO schema_migrations (filename) VALUES ('004_integrations_tools.sql') ON CONFLICT DO NOTHING;
