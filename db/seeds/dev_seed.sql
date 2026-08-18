-- Datos de ejemplo para probar el aislamiento RLS en local.
-- NO se auto-ejecuta (no vive en db/migrations). NO ejecutar en produccion.

INSERT INTO tenants (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tienda Demo A', 'tienda-demo-a'),
  ('22222222-2222-2222-2222-222222222222', 'Tienda Demo B', 'tienda-demo-b');

INSERT INTO contacts (tenant_id, wa_id, display_name) VALUES
  ('11111111-1111-1111-1111-111111111111', '56911111111', 'Cliente de A'),
  ('22222222-2222-2222-2222-222222222222', '56922222222', 'Cliente de B');

INSERT INTO conversations (tenant_id, contact_id, status)
SELECT tenant_id, id, 'open' FROM contacts WHERE wa_id IN ('56911111111', '56922222222');

-- Usuario de prueba para el login del backend (Fase de backend).
-- email:    owner@tienda-a.cl
-- password: Demo1234!
INSERT INTO users (tenant_id, email, password_hash, role, full_name) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'owner@tienda-a.cl',
    '$2b$12$y8Mslobnd8Mim4plqUhrreIX3qpiMUgH9754J/215DL5iTBBKIow6',
    'owner',
    'Dueno Tienda A'
  );
