-- Extensiones requeridas por el esquema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector, embeddings RAG

INSERT INTO schema_migrations (filename) VALUES ('001_extensions.sql') ON CONFLICT DO NOTHING;
