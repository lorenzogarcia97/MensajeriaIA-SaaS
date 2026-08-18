-- Tabla de control de migraciones. Va primera (numero 000) para que
-- exista antes que cualquier otra migracion intente registrarse en ella.
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (filename) VALUES ('000_schema_migrations_table.sql')
ON CONFLICT DO NOTHING;
