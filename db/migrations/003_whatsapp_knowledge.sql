-- ============================================================
-- WHATSAPP_CREDENTIALS - un numero de WhatsApp conectado
-- ============================================================
CREATE TABLE whatsapp_credentials (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    waba_id                 VARCHAR(100) NOT NULL,
    phone_number_id         VARCHAR(100) NOT NULL UNIQUE,
    display_phone_number    VARCHAR(30),
    access_token_encrypted  TEXT NOT NULL,   -- cifrado en la app (CryptoService), nunca texto plano
    webhook_verify_token    VARCHAR(255) NOT NULL,
    connection_status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (connection_status IN ('pending','connected','error','disconnected')),
    quality_rating          VARCHAR(10),
    messaging_tier          VARCHAR(20),
    connected_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- KNOWLEDGE_SOURCES - documentos fuente para RAG
-- ============================================================
CREATE TABLE knowledge_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_type     VARCHAR(20) NOT NULL
                        CHECK (source_type IN ('pdf','docx','csv','url','manual_text')),
    display_name    VARCHAR(255) NOT NULL,
    storage_url     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','indexed','failed')),
    chunk_count     INT NOT NULL DEFAULT 0,
    version         INT NOT NULL DEFAULT 1,
    last_indexed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- KNOWLEDGE_CHUNKS - fragmentos vectorizados (pgvector)
-- ============================================================
CREATE TABLE knowledge_chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    knowledge_source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    chunk_index         INT NOT NULL,
    content             TEXT NOT NULL,
    token_count         INT,
    embedding           VECTOR(1024),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_chunks_embedding
    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_knowledge_chunks_tenant ON knowledge_chunks (tenant_id);

INSERT INTO schema_migrations (filename) VALUES ('003_whatsapp_knowledge.sql') ON CONFLICT DO NOTHING;
