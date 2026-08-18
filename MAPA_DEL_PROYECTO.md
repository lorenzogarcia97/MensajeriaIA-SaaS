# Mapa del Proyecto -- Que es cada carpeta y cada archivo

Referencia rapida de la estructura completa, pensada para orientarse
rapido o para explicarle el proyecto a alguien nuevo.

## Raiz

| Archivo | Para que sirve |
|---|---|
| `README.md` | Como instalar y arrancar todo desde cero |
| `ESTADO_DEL_PROYECTO.md` | Bitacora: que se hizo, que falta, bugs resueltos y por que |
| `docker-compose.yml` | Levanta Postgres y Redis con un comando |
| `package.json` | Scripts compartidos (migrar la BD, correr tests) |
| `pnpm-workspace.yaml` | Declara que esto es un monorepo |
| `turbo.json` | Corre tareas en las 3 apps a la vez |
| `.env.example` | Plantilla de configuracion (el `.env` real nunca se sube a un repo) |
| `META_TOKEN_PERMANENTE.md` | Como generar un token de WhatsApp que no vence (System User en Meta Business Manager) |

## apps/backend -- el producto, funcionando

| Archivo | Que hace |
|---|---|
| `src/main.ts` | Enciende el servidor |
| `src/app.module.ts` | Conecta todos los modulos entre si |
| `src/auth/*` | Login de los DUEÑOS de negocio (no de sus clientes finales) |
| `src/common/interceptors/tenant.interceptor.ts` | En cada peticion, aisla los datos por negocio -- el corazon de la seguridad multi-tenant |
| `src/common/tenant/tenant-context.service.ts` | Guarda el tenant activo durante la peticion |
| `src/common/crypto/crypto.service.ts` | Cifra credenciales de WhatsApp de cada cliente |
| `src/conversations/*` | Ejemplo funcional de lectura de datos aislada por tenant |
| `src/whatsapp/*` | Integracion real con WhatsApp: recibe, guarda, contesta |
| `src/knowledge/*` | Ingesta y busqueda RAG de documentos (pgvector) -- expone la tool `search_knowledge_base` |
| `src/integrations/*` | Tool calling dinamico (Fase 3): lista las `ai_tools` activas de un tenant y ejecuta la que Claude decida, llamando a la API externa configurada en `tenant_integrations` |
| `src/mock-inventory/*` | Endpoint falso (`GET /mock-inventory/stock/:sku`) que simula un proveedor externo, solo para probar `integrations/` sin depender de un sistema real de terceros |

## apps/ai-service, apps/dashboard

Solo un `README.md` cada una por ahora -- instrucciones para cuando se
construyan (Fase 2 y el panel visual).

## db/ -- la base de datos

| Archivo | Que hace |
|---|---|
| `migrations/000-009` | El plano de la base de datos, en orden. La 007 (politicas RLS) es la pieza mas importante de todo el proyecto: es la garantia tecnica de que un negocio nunca ve datos de otro. |
| `seeds/dev_seed.sql` | Datos de prueba -- NUNCA usar en produccion |
| `scripts/migrate.js` | Aplica migraciones nuevas a una base ya existente |
| `scripts/set-whatsapp-token.js` | Guarda el token de WhatsApp de un negocio, cifrado |
| `scripts/onboard-tenant.js` | Conecta un negocio nuevo de punta a punta: tenant + usuario dueno + credenciales de WhatsApp + suscripcion App-WABA por Graph API (ver `onboard-tenant.example.json`) |
| `scripts/seed-mock-inventory-tool.js` | Siembra una `tenant_integrations` + `ai_tool` (`check_stock`) de prueba para Tienda Demo A, apuntando al endpoint falso de `mock-inventory/` |
| `tests/rls.test.js` | Prueba automatica de que el aislamiento entre negocios funciona |

## Como se conecta todo (flujo de un mensaje real)

```
Cliente en WhatsApp
  -> Meta (WhatsApp Cloud API)
  -> whatsapp.controller.ts (recibe el webhook)
  -> whatsapp.service.ts:
       - resuelve a que negocio pertenece (migracion 009)
       - guarda contacto + conversacion + mensaje (protegido por RLS, migracion 007)
       - responde via la API de Meta
  -> de vuelta al cliente en WhatsApp
```
