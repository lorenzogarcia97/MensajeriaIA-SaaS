-- ============================================================
-- FUNCION SECURITY DEFINER PARA RESOLVER EL TENANT DE UN MENSAJE
-- ENTRANTE DE WHATSAPP
--
-- Mismo problema que el login: cuando llega un webhook de Meta no
-- hay ningun JWT ni contexto de tenant todavia -- lo que tenemos es
-- el phone_number_id que recibio el mensaje, y a partir de EL hay
-- que averiguar a que tenant pertenece. Como whatsapp_credentials
-- tiene RLS, una consulta comun devolveria 0 filas sin excepcion.
-- ============================================================
CREATE OR REPLACE FUNCTION find_tenant_by_phone_number_id(p_phone_number_id TEXT)
RETURNS TABLE (tenant_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM whatsapp_credentials
  WHERE phone_number_id = p_phone_number_id
    AND connection_status = 'connected';
$$;

REVOKE ALL ON FUNCTION find_tenant_by_phone_number_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_tenant_by_phone_number_id(TEXT) TO app_user;

INSERT INTO schema_migrations (filename) VALUES ('009_whatsapp_tenant_lookup.sql') ON CONFLICT DO NOTHING;
