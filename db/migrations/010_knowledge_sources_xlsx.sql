-- ============================================================
-- Agrega 'xlsx' como source_type valido en knowledge_sources.
--
-- Motivo: el endpoint nuevo POST /knowledge/documents/upload
-- (subida de archivos reales) soporta PDF, DOCX y XLSX, pero el
-- CHECK original (migracion 003) solo contemplaba 'pdf','docx',
-- 'csv','url','manual_text' -- no habia XLSX porque en ese momento
-- solo existia la carga de texto pegado a mano.
-- ============================================================
ALTER TABLE knowledge_sources
    DROP CONSTRAINT knowledge_sources_source_type_check;

ALTER TABLE knowledge_sources
    ADD CONSTRAINT knowledge_sources_source_type_check
        CHECK (source_type IN ('pdf','docx','xlsx','csv','url','manual_text'));

INSERT INTO schema_migrations (filename) VALUES ('010_knowledge_sources_xlsx.sql') ON CONFLICT DO NOTHING;
