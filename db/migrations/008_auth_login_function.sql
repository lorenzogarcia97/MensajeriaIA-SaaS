-- ============================================================
-- FUNCION SECURITY DEFINER PARA LOGIN
--
-- Problema que resuelve: durante el login todavia NO existe
-- contexto de tenant (SET app.current_tenant_id no se ha
-- ejecutado), por lo que la tabla `users`, protegida por RLS,
-- devolveria CERO filas para cualquier busqueda por email.
--
-- Solucion: una funcion SECURITY DEFINER, propiedad del dueño
-- de la tabla, que se ejecuta con privilegios elevados SOLO
-- para esta consulta puntual y acotada. Es preferible a otorgar
-- BYPASSRLS al rol general de la aplicacion, que abriria la
-- puerta a que un bug en cualquier otra parte del codigo lea
-- datos cross-tenant por accidente.
-- ============================================================
CREATE OR REPLACE FUNCTION find_user_for_login(p_email TEXT)
RETURNS TABLE (id UUID, tenant_id UUID, password_hash TEXT, role VARCHAR)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tenant_id, password_hash, role
  FROM users
  WHERE email = p_email AND is_active = true;
$$;

REVOKE ALL ON FUNCTION find_user_for_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_for_login(TEXT) TO app_user;

INSERT INTO schema_migrations (filename) VALUES ('008_auth_login_function.sql') ON CONFLICT DO NOTHING;
