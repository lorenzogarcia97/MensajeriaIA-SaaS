# Estado del Proyecto — WhatsApp SaaS Platform

Ultima actualizacion: 18 de agosto 2026 -- Fase 3 (Tool Calling
Dinamico) completa: `ClaudeService` generalizado a una lista de tools
+ dispatcher, modulo `integrations/` nuevo, y probado real con una
tool `check_stock` contra un endpoint falso (ver seccion 5). Antes de
eso, confirmado el aislamiento entre tenants en el flujo completo de
WhatsApp + Claude + RAG, con un segundo tenant de credenciales
inventadas en vez de un segundo numero real de Meta (ver seccion 7,
punto 3).

---

## 1. Que existe hasta ahora

- Documento de arquitectura completo (7 secciones).
- Monorepo: `apps/backend` (NestJS, funcional), `apps/ai-service` y
  `apps/dashboard` (stubs, se construyen mas adelante).
- Base de datos: 12 tablas + RLS probado (lectura y escritura), rol de
  aplicacion separado del admin, sistema de migraciones auto-registrado,
  y un test automatizado de aislamiento (`npm test:rls` / `node --test`).
- Backend: login + JWT, `TenantInterceptor` (aislamiento automatico por
  request), y ahora **el Webhook Receiver de WhatsApp, probado con
  mensajes reales**.
- Integracion real con Meta: App creada, numero de prueba, webhook
  verificado y conectado, mensajes entrantes guardados en la base de
  datos con el tenant correcto.

## 2. Tecnologias y APIs en uso (resumen tecnico)

| Capa | Tecnologia | Para que |
|---|---|---|
| Backend | NestJS 11 (TypeScript) | API REST, auth, orquestacion |
| Base de datos | PostgreSQL 18 + pgvector (Docker) | Datos + RLS + futura busqueda semantica |
| ORM / acceso a datos | TypeORM + `pg` (driver crudo para SQL fino) | Entidades + control total sobre transacciones/RLS |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`) + bcrypt | Login del dashboard (no de los usuarios finales de WhatsApp) |
| Mensajeria externa | **WhatsApp Cloud API (Meta Graph API)** | Webhooks entrantes (implementado); envio saliente (pendiente) |
| Tunel de desarrollo | ngrok | Exponer `localhost:3001` a internet para que Meta pueda llamarlo |
| Cifrado | AES-256-GCM (`CryptoService`, nativo de Node) | Credenciales de integraciones de cada tenant |
| Testing | Test runner nativo de Node (`node --test`) | Regresion automatizada de RLS |
| Infra local | Docker Compose (Postgres + Redis) | Entorno de desarrollo reproducible |

## 3. Cómo funciona el flujo de un mensaje de WhatsApp (lo que ya esta armado)

```
Celular del usuario
  -> WhatsApp Cloud API (Meta)
  -> POST a tu webhook (via el tunel de ngrok)
  -> WhatsappController.receive() -- responde 200 OK
  -> WhatsappService.processIncomingWebhook()
       1. Parsea el payload de Meta (remitente, texto, numero receptor)
       2. Resuelve el tenant via find_tenant_by_phone_number_id() (SQL,
          SECURITY DEFINER -- mismo patron que el login)
       3. Abre una transaccion, fija el tenant activo (set_config)
       4. Upsert del contacto, abre/reutiliza la conversacion
       5. Guarda el mensaje (idempotente por whatsapp_message_id)
  -> Todo protegido por las mismas politicas RLS que ya probamos
```

## 4. Bitacora completa de bugs reales encontrados y corregidos

1. Volumen de Postgres en la ruta vieja (pre-18) en vez de la nueva.
2. Politicas RLS sin `WITH CHECK` -- permitian escribir en otro tenant.
3. Pruebas de RLS corriendo como superusuario -- invalidaba la prueba.
4. Paquetes `@nestjs/typeorm`/`jwt`/`passport` en v10, incompatibles con NestJS 11.
5. `.env` nunca creado / creado en el lugar equivocado.
6. `JwtModule.register()` leyendo el `.env` antes de que cargara.
7. `TenantInterceptor` con dependencia request-scoped en el constructor,
   rompiendo la inyeccion de la base de datos.
8. Windows Defender marcando ngrok como falso positivo (conocido, documentado).
9. Meta (interfaz nueva, desde fines de 2025) no conecta la WABA con la
   App automaticamente aunque el webhook se verifique -- hay que hacer
   `POST /{WABA_ID}/subscribed_apps` a mano una vez.
10. `migrate.js` conectandose como `app_user` (sin permisos de esquema)
    en vez de como admin -- variable `DATABASE_URL` compartida para dos
    propositos distintos.
11. Logica de "reconciliacion" de migraciones marcaba migraciones nuevas
    como aplicadas sin correrlas realmente. Reemplazada por un sistema
    donde cada migracion se auto-registra al ejecutarse de verdad.
12. El `package.json` de la raiz era una copia identica del de
    `apps/backend` (mismo nombre, scripts y dependencias de NestJS),
    pese a que el proyecto es un monorepo (`apps/*`). Reemplazado por
    un `package.json` de raiz propio, sin dependencias ajenas.
13. El script `test:rls` mencionado en este documento nunca existio en
    ningun `package.json` -- el test de RLS solo se podia correr
    invocando `node --test db/tests/rls.test.js` a mano. Agregado como
    script real (`npm run test:rls`) en el `package.json` de la raiz.
    De paso se borraron el `node_modules` y `package-lock.json` viejos
    de la raiz (residuo del `npm install` corrido sobre el
    `package.json` duplicado) y se regeneraron limpios.
14. `apps/dashboard/src/app/page.tsx` (la ruta `/`, que deberia mostrar
    la lista de conversaciones) habia quedado con el codigo del login
    pegado encima -- una copia identica de `login/page.tsx`. El login
    funcionaba (guardaba el token) y redirigia a `/`, pero esa ruta
    volvia a mostrar el formulario de login vacio en vez de las
    conversaciones, dando la impresion de que el boton "Ingresar" no
    hacia nada. Reconstruido usando `fetchConversations` de `lib/api.ts`
    (ya existia y funcionaba): lista con contacto/ultimo mensaje, link
    a `/documents` y boton de cerrar sesion.
15. Regresion introducida por el propio item 13: al limpiar el
    `package.json` de la raiz se perdieron `pg` y `dotenv`, que
    `migrate.js` y `set-whatsapp-token.js` necesitan de verdad para
    correr desde la raiz (asi lo dice el comentario del propio
    `migrate.js`). Quedaron rotos hasta que se detecto al armar
    `onboard-tenant.js` (que ademas necesita `bcrypt`). Reagregados
    los tres como dependencias reales del `package.json` de la raiz.

## 4bis. Hito: bot de WhatsApp funcional de punta a punta

A esta altura, un mensaje real completa este circuito sin intervencion manual:

```
Usuario en WhatsApp -> Meta -> Webhook -> tenant resuelto -> guardado en
Postgres (con RLS) -> respuesta generada -> Graph API de Meta -> WhatsApp
del usuario, con la respuesta
```

Es un eco simple (repite el mensaje) porque la IA real es Fase 2 -- pero
toda la tuberia de mensajeria, multi-tenant y persistencia ya esta
probada con datos reales, no solo con seeds de prueba.

## 4ter. Dashboard extendido

Se agrego una pagina `/documents` al dashboard: subir documentos (nombre
+ texto), ver la lista con su estado, y borrarlos -- todo desde el
navegador, sin necesitar PowerShell. Link cruzado con `/` (conversaciones)
para moverse entre las dos pantallas.

## 5. Que falta

**Fase 1 -- COMPLETA.**

**Fase 2 -- COMPLETA.**
- [x] Conexion real a Claude (ClaudeService, modulo `ai/`) reemplazando
      el eco. **Probado real**: mensaje de WhatsApp -> Claude genera la
      respuesta -> se envia de vuelta por la Graph API -> llega al celular.
- [x] Pipeline de ingesta de documentos: `POST /knowledge/documents`
      (chunking por parrafos con overlap, embeddings via Voyage AI
      voyage-4, guardado en knowledge_chunks) -- **probado real**,
      primer documento indexado correctamente.
- [x] Busqueda semantica con pgvector (distancia coseno `<=>`, usa el
      indice HNSW) + tool `search_knowledge_base` conectada a Claude.
      **Probado real**: Claude decidio por si mismo buscar, encontro
      el horario real del documento, y contesto con eso, no una
      respuesta generica.
- [x] Gestion de documentos: `GET /knowledge/documents` (listar) y
      `DELETE /knowledge/documents/:id` (borra en cascada sus
      fragmentos). Probado de punta a punta: crear, listar, borrar.
- [x] Cuenta de Meta + App + numero de prueba de WhatsApp
- [x] Tunel local con ngrok
- [x] Webhook Receiver: verificacion GET + recepcion POST
- [x] Suscripcion App <-> WABA
- [x] Parseo del payload + guardado en base de datos (contactos,
      conversaciones, mensajes) -- **probado con un mensaje real**
- [x] Enviar una respuesta de vuelta via la Graph API -- **probado real**: celular -> Meta -> backend -> Meta -> celular, ida y vuelta completa
- [x] Colas con Redis/BullMQ: el webhook ya no procesa el mensaje
      directo, lo encola y responde al toque. Un Worker separado
      (`WhatsappIncomingProcessor`) lo procesa aparte, con 5
      reintentos automaticos y backoff exponencial si algo falla.
      **Probado de verdad**: un envio que falla reintenta 5 veces
      (2s, 4s, 8s, 16s de espera entre cada uno) y despues queda
      marcado como fallido en Redis, sin perderse.
- [x] Dashboard minimo -- Next.js 16, probado de punta a punta: login -> lista de conversaciones (con nombre de contacto y ultimo mensaje) -> cerrar sesion -> login de nuevo

**Fase 3 -- COMPLETA.**
- [x] `ClaudeService.generateReply()` generalizado: ya no recibe una
      unica funcion `searchKnowledgeBase` hardcodeada, sino una lista
      de `ToolDefinition[]` (nombre + descripcion + json schema) y un
      dispatcher generico `executeTool(toolName, toolInput)` que
      decide como resolver la que Claude pida. `ClaudeService` no sabe
      que hace cada tool -- solo orquesta el loop de tool-calling
      (hasta 3 vueltas) y devuelve el `tool_result` (con `is_error`
      si la ejecucion fallo) para que Claude pueda seguir razonando.
- [x] Modulo nuevo `integrations/` (`IntegrationsService`): 
      `listActiveTools(tenantId)` lee `ai_tools` (activas) y las
      traduce al formato que espera Claude; `executeTool(tenantId,
      toolName, toolInput)` busca la `ai_tools` + su
      `tenant_integrations` asociada, descifra `credentials_encrypted`
      con `CryptoService` (mismo cifrado que `whatsapp_credentials`),
      arma la URL sustituyendo `{parametro}` en `endpoint_path` con lo
      que dio Claude (lo que sobra se agrega como query string), le
      agrega el header/Authorization segun `auth_type`
      (`api_key`/`bearer_token`/`basic`/`oauth2` simplificado), hace
      el `fetch` y devuelve el cuerpo de la respuesta como texto. Se
      llama desde el worker de WhatsApp (fuera de un request HTTP),
      igual patron que `KnowledgeService.searchKnowledgeBase`: abre su
      propia transaccion y fija el tenant con `set_config` a mano.
      `WhatsappService` ahora arma la lista de tools (conocimiento +
      dinamicas del tenant) y el dispatcher en cada mensaje entrante.
- [x] Endpoint falso `GET /mock-inventory/stock/:sku` (modulo
      `mock-inventory/`, sin tocar el frontend ni el dashboard) que
      simula el inventario de un proveedor externo con 3 productos
      (`taladro`: 14 unidades, `martillo`: 0, `cinta-metrica`: 37),
      exige un header `X-API-Key` como cualquier API real de
      terceros -- sirve para probar el flujo completo sin depender de
      un sistema externo real.
- [x] Script `db/scripts/seed-mock-inventory-tool.js`: registra una
      `tenant_integrations` (`rest_api`, `base_url:
      http://localhost:3001`, credenciales cifradas) apuntando al
      endpoint falso, y una `ai_tools` `check_stock` que la usa, para
      Tienda Demo A.
- [x] **Probado real, de punta a punta, con dos preguntas por WhatsApp
      simulado** (`POST` directo a `localhost:3001/webhook/whatsapp`,
      phone_number_id real de Tienda Demo A, sin pasar por Meta de
      verdad -- ver nota tecnica abajo):
      - "Tienen stock de taladro?" -> Claude llamo `check_stock`
        (no `search_knowledge_base`) y contesto "14 unidades en
        stock, a $29.990" -- ese numero exacto solo existe en el mock,
        no en el documento de conocimiento de la tienda, lo que
        confirma que la tool correcta fue la que respondio.
      - "Y tienen sierra electrica?" -> el mock devolvio 404 y Claude
        contesto con honestidad que no la manejan, sin inventar un
        numero de stock.
      - Nota tecnica: Tienda Demo A tiene un token **real** conectado
        a Meta (a diferencia de la prueba de aislamiento de la
        seccion 7, punto 3, que uso un tenant con credenciales
        inventadas) -- un envio real de WhatsApp ya causo
        restricciones de cuenta antes, asi que para esta prueba se
        comento momentaneamente la llamada a `sendTextMessage()` en
        `whatsapp.service.ts` (se persistia la respuesta directo, sin
        tocar la Graph API) y se revirtio al codigo original apenas
        se confirmo el resultado en la tabla `messages` -- no quedo
        ningun cambio de comportamiento en el repo.

**Fase 4:** produccion/escalado -- sin tocar todavia.

## 6. Notas operativas utiles

- **Voyage AI: usar la cuenta independiente (dash.voyageai.com), NO la
  key generada desde "AI Models" de MongoDB Atlas.** Son dos sistemas
  de autenticacion distintos aunque el modelo (voyage-4) sea el mismo:
  las keys de Atlas solo funcionan contra `ai.mongodb.com` (endpoint
  todavia en "preview"), las de Voyage directo contra
  `api.voyageai.com` (el producto estable). El codigo usa la segunda.

- El WABA no se conecta solo a la App con verificar el webhook -- hay
  que hacer `POST /{WABA_ID}/subscribed_apps` a mano una vez (Graph API Explorer).
- El token temporal de Meta dura 24 horas; para produccion hace falta
  uno permanente (System User token).
- ngrok gratis cambia de URL al reiniciar -- hay que actualizar la
  Callback URL en Meta cada vez que pase, durante desarrollo.
- `migrate.js` siempre se corre como `node db/scripts/migrate.js`
  (nunca via `npm run`, para no depender de que el `package.json` este
  sincronizado) y usa el rol admin, no el de la aplicacion.
- El test de RLS ahora si se puede correr como `npm run test:rls` desde
  la raiz (antes habia que invocar `node --test db/tests/rls.test.js`
  a mano).
- El repo tiene `pnpm-workspace.yaml`, pero por ahora se sigue
  trabajando con `npm` (cada app con su propio `node_modules`
  independiente) -- no se migro a pnpm todavia.

## 7. Endurecimiento antes de sumar mas funcionalidad

Tres puntos de hardening levantados antes de seguir con features nuevas:

1. **ENCRYPTION_KEY placeholder -- revisado, no hacia falta.** Se
   verifico el `.env` real: la key ya es un hex valido de 32 bytes (no
   ceros), y el token de WhatsApp guardado en `whatsapp_credentials`
   desencripta correctamente con ella. No se toco nada -- probablemente
   ya se habia corregido en una sesion anterior, o se confundio con
   `.env.example` (que si tiene `ENCRYPTION_KEY=` vacio, como plantilla).

2. **Token permanente de WhatsApp (System User) -- COMPLETO para
   Tienda Demo A.** Proceso documentado en `META_TOKEN_PERMANENTE.md`.
   Token generado a mano en Business Settings (System User, expiracion
   "Nunca") y guardado cifrado con
   `node db/scripts/set-whatsapp-token.js 1241828399019171 <token>`.
   Verificado en vivo contra la Graph API (`debug_token`):
   `type: SYSTEM_USER`, `expires_at: 0` (nunca vence), `is_valid: true`,
   scopes `whatsapp_business_management` + `whatsapp_business_messaging`
   presentes. Ya no depende de renovar un token cada 24 horas.

3. **Segundo tenant de prueba -- aislamiento confirmado, con
   credenciales de Meta inventadas (COMPLETO).** Pedirle a Meta un
   segundo numero de prueba real costo dos restricciones de cuenta
   (documentado como riesgo real, no solo teorico), asi que se cambio
   de estrategia: probar el aislamiento sin depender de un segundo
   numero real ni de ngrok/Meta en absoluto.

   - Se corrio `db/scripts/onboard-tenant.js` con un `phoneNumberId`
     (`999999999999999`), `wabaId` y `accessToken` inventados --
     tenant "Tienda Demo B" (slug `tienda-demo-b-live`, para no
     chocar con el tenant placeholder del seed que ya usaba el slug
     `tienda-demo-b`) mas su usuario dueno creados de punta a punta
     por el script, tal como esta disenado.
   - Como era de esperar, la suscripcion automatica App-WABA fallo
     (Meta respondio 401 `Invalid OAuth access token data` -- el
     token es inventado) y `connection_status` quedo en `pending`.
     Se forzo a mano a `connected` con el mismo UPDATE que el propio
     script sugiere en su mensaje de error -- necesario ademas porque
     `find_tenant_by_phone_number_id()` (migracion 009) solo resuelve
     tenants con `connection_status = 'connected'`.
   - Se subio, via `POST /knowledge/documents` (login real de cada
     dueno), un documento de conocimiento propio y distinto por
     tenant: horario, direccion y "codigo secreto" distintos para
     Tienda A (Lunes a Viernes 09:00-18:00, Avenida Ferretera 100,
     Santiago, `FERRETERO-30`) y Tienda B (todos los dias 10:00-20:00,
     Pasaje Textil 250, Valparaiso, `MODA-VALPO-7`).
   - Se simulo un mensaje entrante con un `POST` directo a
     `localhost:3001/webhook/whatsapp` (sin ngrok, sin Meta real)
     usando el `phone_number_id` inventado de Tienda B en el payload.
     El mensaje se encolo, el worker lo proceso, resolvio el tenant
     correcto por `phone_number_id`, y Claude uso
     `search_knowledge_base` para responder **solo** con los datos de
     Tienda B ("Nuestro horario es todos los dias de 10:00 a 20:00
     hrs, y estamos ubicados en Pasaje Textil 250, Valparaiso") --
     verificado leyendo la tabla `messages` directo en Postgres, sin
     ninguna mencion a los datos de Tienda A. Como beneficio
     adicional (no buscado a proposito), Claude tambien se nego a
     compartir el "codigo secreto" cuando se le pidio directo.
   - Nota tecnica: como el token de Tienda B es inventado, el envio
     final por la Graph API de Meta iba a fallar si o si (401/400) --
     eso hubiera hecho que el mensaje de salida nunca se guardara en
     `messages` (el codigo guarda la respuesta DESPUES de enviarla por
     Meta con exito) y que la cola reintentara sin poder confirmarse
     nada. Se cambio momentaneamente el orden en
     `whatsapp.service.ts` (guardar la respuesta antes de intentar
     enviarla, y no relanzar el error del envio) solo para esta
     prueba manual, y se revirtio exactamente al codigo original
     apenas se confirmo el resultado -- no quedo ningun cambio de
     comportamiento en el repo.
   - El tenant placeholder original del seed (`tienda-demo-b`, sin
     dueno ni credenciales) se dejo intacto -- el tenant nuevo de esta
     prueba es uno aparte.
