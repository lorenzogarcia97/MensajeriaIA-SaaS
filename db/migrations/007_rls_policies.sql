-- ============================================================
-- ROL DE APLICACION (sin privilegios de superusuario)
--
-- whatsapp_saas (el rol de POSTGRES_USER) es SUPERUSUARIO -- asi
-- lo crea Postgres al inicializar el contenedor, no es algo que
-- se configuro a proposito. Y un superusuario se salta TODA
-- politica de RLS, sin excepcion. Por eso las pruebas de
-- aislamiento deben correr con este rol nuevo, NUNCA con
-- whatsapp_saas -- ese rol queda reservado para migraciones y
-- administracion del esquema, nunca para servir requests.
-- ============================================================
CREATE ROLE app_user WITH LOGIN PASSWORD 'devpassword_app' NOSUPERUSER NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Para que las tablas que se creen en migraciones FUTURAS tambien
-- queden accesibles a app_user automaticamente, sin tener que
-- acordarse de un GRANT nuevo cada vez:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ============================================================
-- ROW LEVEL SECURITY - aislamiento obligatorio a nivel de motor
-- ============================================================

ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- tenants: caso especial, la fila "es" el tenant -> se filtra por id
CREATE POLICY tenant_isolation_policy ON tenants
    USING (id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON users
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON whatsapp_credentials
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON knowledge_sources
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON knowledge_chunks
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON tenant_integrations
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON ai_tools
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON contacts
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON conversations
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON messages
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON message_templates
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON audit_logs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- current_setting(..., true) con missing_ok=true: si la variable de sesion
-- no esta seteada, retorna NULL -> "tenant_id = NULL" es siempre false ->
-- CERO filas visibles y CERO escrituras permitidas. Falla en modo seguro.

INSERT INTO schema_migrations (filename) VALUES ('007_rls_policies.sql') ON CONFLICT DO NOTHING;
