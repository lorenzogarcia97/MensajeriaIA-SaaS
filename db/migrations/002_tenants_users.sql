-- ============================================================
-- TENANTS - nucleo del multi-tenancy. No lleva RLS por tenant_id
-- porque la fila ES el tenant; su propia politica esta en
-- 007_rls_policies.sql (acceso restringido a la propia fila).
-- ============================================================
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    plan            VARCHAR(50)  NOT NULL DEFAULT 'trial'
                        CHECK (plan IN ('trial','starter','growth','enterprise')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','cancelled')),
    settings        JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS - usuarios internos del negocio cliente (dueños/agentes)
--
-- NOTA DE DISENO: el email es UNICO A NIVEL DE PLATAFORMA (no por
-- tenant). Es intencional: en el momento del login todavia NO se
-- sabe a que tenant pertenece el usuario, por lo que la busqueda
-- inicial debe poder resolverse por email solo. Ver 008_auth_login_function.sql.
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'agent'
                        CHECK (role IN ('owner','admin','agent')),
    full_name       VARCHAR(255),
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (filename) VALUES ('002_tenants_users.sql') ON CONFLICT DO NOTHING;
