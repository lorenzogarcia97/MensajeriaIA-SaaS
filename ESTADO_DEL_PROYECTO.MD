# Estado del Proyecto — WhatsApp SaaS Platform

Ultima actualizacion: 19 de agosto 2026 -- observabilidad basica en el
backend, antes de seguir sumando features de Fase 4 (ver seccion 9 para
el detalle completo): SDK oficial de Sentry para NestJS (`@sentry/nestjs`,
no un paquete de comunidad) capturando tanto excepciones del ciclo HTTP
como fallos DEFINITIVOS del Worker de BullMQ (`WhatsappIncomingProcessor`
-- capturados a mano con `Sentry.captureException`, confirmado que la
instrumentacion automatica NO cubre el Worker por si sola, la misma clase
de fallo silencioso del bug #16); y un `GET /health` nuevo que chequea
conectividad REAL a Postgres y Redis (no solo "el proceso esta vivo"),
con timeout propio por chequeo y `503` si algo falla. Probado forzando
errores reales (un endpoint temporal, ya borrado, y parando/levantando
los contenedores de Postgres y Redis a mano) -- `/health` reporto `503`
en los tres casos de falla y volvio a `200` al restaurar cada servicio.
**Bug real encontrado en la propia integracion de Sentry, ya corregido**:
la primera vez que se probo, solo aparecio en Sentry un issue de ejemplo
(el que crea Sentry solo al crear el proyecto) -- los dos errores de
prueba forzados NO llegaron. Causa: `instrument.ts` corre ANTES que
`ConfigModule.forRoot()` (que carga el `.env`), asi que `Sentry.init()`
se ejecutaba con `dsn: undefined` y el SDK quedaba en modo no-op sin que
nada lo advirtiera. Corregido cargando el `.env` a mano con `dotenv`
dentro de `instrument.ts`, con los mismos paths que usa `ConfigModule`.
Reprobado con los mismos dos errores forzados (mensaje cambiado a
"REINTENTO 2" para distinguirlos) -- el usuario confirmo en el dashboard
de Sentry que esta vez SI llegaron los dos. Ver bug #19 y el punto 3 de
la seccion 9, actualizado.
Antes de eso, corregido el bug de UX del
login del dashboard detectado en la sesion anterior: mostraba "Email o
contraseña incorrectos" para CUALQUIER error, incluida la caida del
backend. `apps/dashboard/src/lib/api.ts` ahora expone una clase `ApiError`
con un `code` (`network_error` / `invalid_credentials` / `server_error`)
segun la causa real del fallo, y `login/page.tsx` muestra un mensaje
distinto para cada caso. Probado en el navegador en los tres escenarios
(contraseña incorrecta, backend caido simulado con `fetch` mockeado, y
login real exitoso) -- ver bug #18 en la seccion 4, ya marcado como
corregido. Antes de eso, rediseño visual completo del
dashboard (`apps/dashboard`): login, conversaciones y documentos ahora
usan la identidad de marca "Conversa" (paleta verde-petroleo/papel-salvia
/naranja-quemado, tipografia Roboto Slab para titulos + Work Sans para
cuerpo) tomada de la landing real del producto en `web_page/index.html`
(fuera de este repo, en la carpeta padre) -- antes el dashboard usaba
clases de Tailwind genericas (`bg-gray-50`, `text-blue-600`, etc.) sin
ninguna identidad propia, como si fuera una herramienta interna generica
en vez de parte del mismo producto que la landing. Cambios: los tokens de
color/tipografia se movieron a `globals.css` como variables de tema de
Tailwind v4 (`bg-paper`, `text-ink`, `bg-accent`, `font-serif`, etc.),
`layout.tsx` paso de las fuentes Geist por defecto de `create-next-app` a
Roboto Slab + Work Sans via `next/font/google`, se extrajo un nav
compartido (`components/DashboardNav.tsx`, usado en conversaciones y
documentos en vez de duplicar el header a mano en cada pagina), y las
tres paginas sumaron estados vacios propios ("Todavia no hay
conversaciones", etc.) y de carga con spinner en vez de un parrafo gris
generico, ademas de formularios con foco/labels cuidados en vez de los
defaults del navegador. **La funcionalidad no cambio en nada** -- mismos
handlers, mismos endpoints, mismo flujo de login/fetch/upload/delete.
Verificado visualmente en el navegador (Chrome, via la extension
`claude-in-chrome`) con `fetch` mockeado para forzar y revisar los tres
estados (vacio/cargando/con datos) de cada pagina, ya que el backend
local no estaba corriendo en ese momento. De paso, al levantar despues el
backend para una prueba de login, se confirmo que el usuario de
desarrollo (`owner@tienda-a.cl` / `Demo1234!`, ver `db/seeds/dev_seed.sql`)
si funciona -- el "no puedo ingresar" que reporto el usuario no era la
contraseña, sino que el backend no estaba levantado; el login del
dashboard atrapa CUALQUIER error en el `catch` (incluida una falla de red
por backend caido) y siempre muestra "Email o contraseña incorrectos",
sin distinguir un 401 real de "no hay servidor escuchando" -- bug de UX
identificado pero **todavia no corregido** (ver bug #18 en la seccion 4).
Antes de eso, cerrado por completo el bug
#17 (Render sin datos del tenant). Se copio la base de conocimiento
(RAG) de Tienda Demo A que faltaba: leidos sus `knowledge_sources`/
`knowledge_chunks` en local (reconstruyendo el documento completo
desde los fragmentos), resubido via `POST /knowledge/documents` con
login real contra el backend ya desplegado en Render, y confirmado
`status: indexed`. Probado de punta a punta con un WhatsApp real
mandado por el usuario (evitando simular el webhook, por el riesgo de
restriccion de cuenta con el token real de este tenant): el bot en
Render contesto el horario real del documento, no una respuesta
generica -- ver bug #17 en la seccion 4. Antes de eso, bug real en
produccion corregido: con el backend ya desplegado en Render, los
mensajes de WhatsApp no se procesaban (`No hay ningun tenant conectado
al phone_number_id ...`) porque Render tenia el esquema (migraciones
aplicadas) pero CERO datos -- el onboarding real del tenant solo se
habia hecho contra la base local. Copiada la fila de tenant + usuario
dueno + `whatsapp_credentials` (token cifrado, sin desencriptar en
ningun momento) de local a Render; requirio antes sincronizar
`ENCRYPTION_KEY` entre ambos entornos. Verificado en vivo que la
funcion de lookup ya resuelve el tenant en Render. Antes de eso,
probado en vivo contra la
base de Render real: el fix de SSL conecta sin error (y de paso revelo
que esa base ya tenia las 10 migraciones aplicadas de antes, con
`app_user` usando todavia la password hardcodeada de la migracion
007). Rotada esa password con `set-prod-role-password.js` y una
password nueva generada al azar -- entregada al usuario para que
actualice `DATABASE_URL` en Render, no quedo guardada en ningun
archivo (ver seccion 8, punto 5). Antes de eso, bug real de produccion
corregido: `WhatsappIncomingProcessor` (el Worker de BullMQ) se habia
vuelto REQUEST-scoped por transitividad via `KnowledgeService` (que
inyectaba `TenantContextService` en el constructor para sus metodos
HTTP, contagiando el scope a la clase entera, incluido el metodo que
usa el worker) -- visible en el log de arranque como una advertencia
de BullMQ ignorando el listener `onFailed`, y con una causa de fondo
bastante mas seria: el pipeline de WhatsApp dependiendo de un contexto
de request que no existe en el Worker. Corregido separando
`KnowledgeService` en dos clases (`KnowledgeSearchService` nueva,
singleton de verdad, para el path del worker) -- ver bug #16 en la
seccion 4. Antes de eso, `BullModule.forRoot()` sumo soporte de
password/TLS via `REDIS_URL` (o `REDIS_HOST/PORT/PASSWORD` sueltos),
necesario para el Redis administrado de Render, y se dejo la lista
completa y final de variables de entorno para desplegar el backend en
Render (ver seccion 8, puntos 7 y 8). Justo antes, corregido
el bug de "SSL/TLS required" contra Postgres administrado (Render):
nuevo helper compartido `getPgSslConfig()` (SSL solo fuera de
localhost) aplicado en todos los scripts que abren `pg.Client` y en el
`TypeOrmModule.forRoot()` del backend, mas un script nuevo
(`set-prod-role-password.js`) para rotar la password de `app_user`
antes de exponer la base a internet (ver seccion 8, puntos 5 y 6).
Antes de eso, Fase 3 (Tool Calling
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
- Monorepo: `apps/backend` (NestJS, funcional) y `apps/dashboard`
  (Next.js, funcional -- login, conversaciones, documentos, con la
  identidad visual "Conversa", ver seccion 4quater). `apps/ai-service`
  sigue siendo un stub, se construye mas adelante.
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
| Observabilidad | Sentry (`@sentry/nestjs`, SDK oficial) + `GET /health` | Captura de errores (HTTP y Worker de BullMQ) + chequeo real de conectividad a Postgres/Redis |

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
16. `WhatsappIncomingProcessor` (el Worker de BullMQ) se habia vuelto
    REQUEST-scoped por transitividad, sin que nada lo dijera en el
    codigo -- solo se hizo visible en produccion como una advertencia
    de arranque: `[BullModule] Warning! 'WhatsappIncomingProcessor'
    class is request-scoped and it defines an event listener... this
    handler will be ignored`. La cadena real: `KnowledgeService`
    inyectaba `TenantContextService` (REQUEST-scoped, ver bug #7) en
    su constructor -- necesario para sus metodos de
    `KnowledgeController` (`ingestDocument`/`listDocuments`/
    `deleteDocument`), pero en NestJS el scope de un provider se
    contagia a TODO lo que lo inyecte, a nivel de clase completa, no
    de metodo. Como `searchKnowledgeBase()` (llamado desde el worker,
    sin `TenantContextService`, con su propio `queryRunner` manual)
    vivia en la MISMA clase que los metodos HTTP, toda `KnowledgeService`
    quedaba REQUEST-scoped -- y por lo tanto tambien `WhatsappService`
    (que la inyectaba) y `WhatsappIncomingProcessor` (que inyecta a
    `WhatsappService`). Un Worker de BullMQ corre fuera de cualquier
    request HTTP, asi que ese scope nunca podia resolverse de verdad;
    el sintoma visible fue que Nest simplemente ignoraba el
    `@OnWorkerEvent('failed')` del processor, pero el problema de
    fondo era mas serio: el pipeline completo de mensajes de WhatsApp
    dependia de un contexto de request que no existia en el Worker.
    **Corregido separando la clase**: los metodos que usa el worker
    (`searchKnowledgeBase`, `getToolDefinition`) se movieron a un
    servicio nuevo y realmente singleton, `KnowledgeSearchService`
    (`knowledge/knowledge-search.service.ts`, sin `TenantContextService`
    en su constructor), y `WhatsappService` pasa a depender de ese en
    vez de `KnowledgeService`. `KnowledgeService` (el que usa
    `KnowledgeController`) se quedo solo con los metodos HTTP y sigue
    REQUEST-scoped, que es lo correcto para un controller. Se reviso
    ademas TODO el modulo `integrations/` (la sospecha inicial, por
    ser de Fase 3): `IntegrationsService` nunca inyecto
    `TenantContextService` -- ya seguia el patron correcto desde que
    se escribio. Verificado: arranque del backend ya sin la
    advertencia de BullMQ, y el test de RLS (`npm run test:rls`) sigue
    pasando completo.
17. **Bug real en produccion: Render nunca tuvo los datos del tenant,
    solo el esquema.** Ya con el backend desplegado y `DATABASE_URL`/
    `ENCRYPTION_KEY` correctos en Render, los mensajes de WhatsApp
    seguian sin procesarse -- el log mostraba `No hay ningun tenant
    conectado al phone_number_id 1241828399019171`
    (`find_tenant_by_phone_number_id()`, migracion 009, devolvia 0
    filas). Se conecto directo a la base de Render con
    `ADMIN_DATABASE_URL` y se confirmo la causa: `SELECT count(*) FROM
    tenants` y `whatsapp_credentials` daban **0** -- las migraciones
    (el esquema) si estaban aplicadas ahi, pero el onboarding real
    (`onboard-tenant.js`, `set-whatsapp-token.js`) solo se habia
    corrido contra el Postgres local de Docker, nunca contra Render.
    Ambas bases quedaron con esquemas identicos pero datos
    completamente distintos sin que nada lo advirtiera.
    **Corregido**: copiado directo de la fila de `tenants` ("Tienda
    Demo A"), su usuario dueno, y su `whatsapp_credentials` (el
    `access_token_encrypted` se copio TAL CUAL, como blob opaco --
    nunca se desencripto durante la copia) de local a Render, con un
    script one-off. Requisito previo verificado con el usuario:
    `ENCRYPTION_KEY` en Render actualizado para ser IDENTICO al de
    `.env` local -- si no coincide, el token copiado no se puede
    desencriptar en runtime aunque la fila exista. Verificado en vivo:
    `find_tenant_by_phone_number_id('1241828399019171')` contra Render
    ya devuelve el tenant correcto.
    **Pendiente real -- YA RESUELTO.** Los `knowledge_sources`/
    `knowledge_chunks` (documentos de la base de conocimiento, RAG) de
    este tenant tampoco se habian copiado -- solo tenant + usuario +
    credenciales de WhatsApp (ver arriba). Se leyo el unico documento
    de Tienda Demo A en local ("Info de contacto y horarios - Tienda
    Demo A", 1 solo chunk) reconstruyendo su texto completo desde
    `knowledge_chunks` (ordenado por `chunk_index`), y se resubio via
    `POST /knowledge/documents` con login real (`owner@tienda-a.cl`)
    contra el backend ya desplegado en Render (no localhost) -- misma
    password de desarrollo documentada en `db/seeds/dev_seed.sql`
    (`Demo1234!`), que sigue siendo valida en Render porque la fila de
    `users` (con su hash bcrypt) se copio tal cual en el fix anterior
    de este mismo bug. Confirmado con `GET /knowledge/documents` en
    Render: `status: indexed`, `chunk_count: 1`.
    **Prueba real de punta a punta, ya hecha**: en vez de simular el
    webhook con un numero inventado (riesgo real de restriccion de
    cuenta en Meta, como paso antes con este mismo tenant -- ver Fase
    3 en la seccion 5 -- porque a diferencia de Tienda Demo B, Tienda
    Demo A tiene un token **real** conectado), se le pidio al usuario
    mandar un WhatsApp de verdad preguntando el horario. Verificado
    con `GET /conversations` contra Render: la respuesta del bot fue
    "Nuestro horario de atencion es de lunes a viernes de 09:00 a
    18:00 hrs" -- el dato real del documento recien subido, no una
    respuesta generica. Bug #17 cerrado por completo: tenant, usuario,
    credenciales de WhatsApp y base de conocimiento ya estan
    replicados en Render, y el flujo completo (WhatsApp real -> Meta
    -> Render -> Claude -> RAG -> respuesta -> Meta -> WhatsApp del
    usuario) esta probado en produccion.
18. **Corregido: el login del dashboard no distinguia credenciales
    invalidas de backend caido.**
    `apps/dashboard/src/app/login/page.tsx` envolvia `login()` en un
    `try/catch` que mostraba siempre el mismo mensaje ("Email o
    contraseña incorrectos.") sin mirar la causa real del error --
    tanto un 401 del backend como un `fetch` que nunca pudo conectar
    (backend apagado, URL mal, red caida) caian en el mismo `catch`.
    Se detecto porque el usuario reporto "no puedo ingresar" con
    `owner@tienda-a.cl` / `Demo1234!` (credenciales correctas,
    verificadas con `bcrypt.compareSync` contra el hash de
    `db/seeds/dev_seed.sql`) cuando el problema real era que el backend
    no estaba corriendo en local. **Arreglado**: `lib/api.ts` sumo una
    clase `ApiError` con un `code` (`network_error` / `invalid_credentials`
    / `server_error`) segun la causa real -- `fetch` que nunca conecta,
    401 del backend, o cualquier otro `!res.ok` -- y `login/page.tsx`
    muestra un mensaje distinto para cada caso ("No se pudo conectar con
    el servidor. Verifica que el backend este activo." para la caida de
    red, "Email o contraseña incorrectos." solo para el 401, un mensaje
    generico para el resto). Probado en el navegador (Chrome, via
    `claude-in-chrome`) en los tres escenarios: contraseña incorrecta con
    backend arriba, `fetch` mockeado para simular backend caido, y login
    real exitoso -- los tres muestran el mensaje correcto.
19. **Corregido: Sentry quedaba en modo no-op porque `instrument.ts`
    corria antes de que se cargara el `.env`.** Al integrar Sentry (ver
    seccion 9) y probarlo forzando dos errores reales, en Sentry solo
    aparecio un issue de ejemplo (el que Sentry crea solo al armar el
    proyecto) -- ninguno de los dos errores de prueba llego, sin ningun
    mensaje de error que lo advirtiera. Causa: `apps/backend/src/main.ts`
    hace `import './instrument'` como primera linea (requisito del SDK),
    y `instrument.ts` llama a `Sentry.init({ dsn: process.env.SENTRY_DSN
    })` en el momento en que se importa -- pero `process.env.SENTRY_DSN`
    todavia no existia en ese punto, porque quien carga el `.env` es
    `ConfigModule.forRoot()` dentro de `AppModule`, y `AppModule` se
    importa DESPUES de `instrument.ts` en el mismo `main.ts`. El SDK de
    Sentry, inicializado con `dsn: undefined`, arranca en modo no-op por
    diseno (para no romper el arranque si falta la variable) -- silencioso
    a proposito, lo que lo hizo dificil de notar sin probar de verdad con
    un error forzado. **Corregido**: `instrument.ts` ahora carga el `.env`
    el mismo con `dotenv.config()` (paquete agregado como dependencia
    directa del backend, antes solo transitivo via `@nestjs/config`),
    usando los mismos dos paths que `ConfigModule.forRoot()`, ANTES de
    llamar a `Sentry.init()`. Reprobado forzando los mismos dos errores
    de nuevo: el stack trace en los logs del backend paso a mostrar
    frames de `@sentry/nestjs`/`@sentry/opentelemetry` envolviendo la
    llamada (senal de que el SDK esta instrumentando de verdad, cosa que
    no aparecia antes), y el usuario confirmo en el dashboard de Sentry
    que esta vez llegaron los dos issues.

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

## 4quater. Rediseño visual del dashboard (identidad "Conversa")

Las tres paginas del dashboard (`login`, `/` conversaciones, `/documents`)
pasaron de Tailwind generico a la identidad visual real del producto,
tomada de la landing (`web_page/index.html`, fuera de este repo, carpeta
padre -- no confundir con `apps/dashboard`):

- **Paleta**: verde-petroleo oscuro (`--ink`) como color de texto/marca,
  papel salvia claro (`--paper`) de fondo, una tarjeta mas clara
  (`--card`) para superficies, naranja quemado (`--accent`) para acciones
  primarias y estados de error, dorado (`--gold`) para badges de estado.
  Definida en `apps/dashboard/src/app/globals.css` como variables CSS y
  mapeada a utilidades de Tailwind v4 (`@theme inline`) para poder usar
  `bg-paper`, `text-ink`, `bg-accent`, `border-line`, etc. directo en el
  JSX.
- **Tipografia**: Roboto Slab (titulos, `font-serif`) + Work Sans (cuerpo,
  `font-sans`), cargadas con `next/font/google` en `layout.tsx` en vez de
  las fuentes Geist que trae `create-next-app` por defecto.
- **Componente nuevo**: `apps/dashboard/src/components/DashboardNav.tsx`
  -- el header con el logo "Convers*a*" (la "a" final en naranja) y los
  links Conversaciones/Documentos/Cerrar sesion, antes duplicado a mano
  en cada pagina.
- **Estados**: las tres pantallas ahora tienen estado vacio propio (texto
  + subtexto explicando que hacer), estado de carga con spinner en vez de
  "Cargando..." en texto plano, y estado de error con fondo naranja
  suave en vez de texto rojo simple.
- La funcionalidad (login, fetch, upload, delete, logout, redirects) no
  cambio -- fue un cambio puramente visual, verificado en el navegador con
  datos mockeados para los tres estados de cada pagina.

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

**Fase 4:** produccion/escalado -- EN CURSO.
- [x] Observabilidad basica: Sentry (SDK oficial `@sentry/nestjs`) +
      `GET /health` con chequeo real de Postgres/Redis. Ver seccion 9.
- [ ] El resto de produccion/escalado: sin tocar todavia.

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

## 8. Preparacion para desplegar en Render

1. **Git inicializado.** El proyecto no tenia repositorio git. Se
   instalo Git (no estaba presente en el sistema, via `winget install
   Git.Git`), se corrio `git init` en la raiz, y se hizo el primer
   commit (88 archivos, rama `main`). No existia `.gitignore` en la
   raiz (solo uno dentro de `apps/dashboard`) -- se creo uno nuevo en
   la raiz que cubre `node_modules/`, `dist/`, `.next/`, `.env` y
   variantes en **todas** las apps del monorepo (patrones `**/`).
   Verificado con `git status` antes del commit: ni `.env` (con
   secretos reales) ni ningun `node_modules`/`dist`/`.next` quedaron
   staged.

2. **Repo en GitHub: pendiente, requiere accion manual.** El CLI `gh`
   no esta instalado y no hay credenciales de GitHub configuradas en
   esta maquina, asi que no se pudo crear ni conectar el remoto
   automaticamente. Instrucciones para hacerlo a mano estan en la
   respuesta de la sesion donde se hizo este trabajo (crear repo vacio
   en GitHub, `git remote add origin <url>`, `git push -u origin
   main`).

3. **`start:prod` del backend corregido.** Existia pero solo hacia
   `node dist/main.js` (asumia que `dist/` ya estaba compilado).
   Cambiado a `"npm run build && node dist/main.js"` para que Render
   pueda usarlo como Start Command sin depender de un Build Command
   separado que corra antes.

4. **Lista de variables de entorno para Render:** ver la tabla completa
   al final de esta seccion (punto 8).

5. **`app_user` con la password de desarrollo hardcodeada en la
   migracion -- rotada contra Render, YA COMPLETO.** La migracion
   `007_rls_policies.sql` crea `app_user` con
   `WITH LOGIN PASSWORD 'devpassword_app'` -- una password de
   desarrollo, en texto plano, en un archivo versionado. Al conectarse
   por primera vez a la base de Render con `ADMIN_DATABASE_URL` real
   (para probar el fix de SSL, punto 6) se confirmo que esa base **no
   estaba vacia**: las migraciones `000` a `009` ya figuraban
   aplicadas, es decir, `app_user` ya existia ahi con la password
   hardcodeada, expuesta a internet. Se corrio
   `db/scripts/set-prod-role-password.js <admin_connection_url>
   <password_nueva>` con una password nueva generada al azar
   (`openssl rand -hex 24`, 48 caracteres hex -- sin caracteres que
   necesiten escape en una connection string) contra la base real de
   Render. La password nueva se le entrego al usuario para que
   actualice `DATABASE_URL` a mano en las variables de entorno del
   backend en Render (con el rol `app_user`, no el admin) y para que
   la guarde en un gestor de contraseñas -- no quedo guardada en
   ningun archivo del repo ni de este documento.
   **Pendiente real:** actualizar esa variable en el dashboard de
   Render y reiniciar/redeployar el servicio -- hasta entonces, el
   backend desplegado sigue con la password vieja en su config y va a
   fallar al conectarse.

6. **Bug real: "SSL/TLS required" al conectar a Render -- corregido en
   todos los puntos de conexion directa a Postgres.** Render exige SSL
   en la conexion y el cliente `pg` no lo pedia -- localhost (Docker)
   funcionaba porque Postgres local no tiene SSL configurado, pero
   contra Render la conexion fallaba de entrada, antes de poder correr
   ni una migracion. Se agrego un helper compartido,
   `db/lib/pg-ssl.js` (`getPgSslConfig(connectionString)`): si el host
   de la URL es `localhost`/`127.0.0.1` no usa SSL, para cualquier
   otro host usa `{ rejectUnauthorized: false }` (patron estandar para
   Postgres administrado tipo Render/Heroku, cuyos certificados no
   siempre encadenan a una CA publica conocida por Node). Aplicado en
   los cinco scripts de `db/scripts/` que abren un `pg.Client`
   (`migrate.js`, `set-whatsapp-token.js`, `set-prod-role-password.js`,
   `onboard-tenant.js`, `seed-mock-inventory-tool.js`) y en
   `db/tests/rls.test.js` (los tres clientes: admin, app, y el
   `freshClient` de la prueba sin contexto de tenant). Para el backend
   se creo el equivalente en TypeScript,
   `apps/backend/src/common/config/pg-ssl.util.ts`, usado en el
   `TypeOrmModule.forRoot()` de `app.module.ts` -- este ultimo era el
   punto **critico**: sin el fix, el backend desplegado en Render
   fallaria al arrancar con el mismo error, no solo las migraciones
   manuales.
   **Verificado en vivo**: `node db/scripts/migrate.js` con
   `ADMIN_DATABASE_URL` apuntando a la base real de Render conecto sin
   el error "SSL/TLS required" (ver punto 5 -- de paso revelo que esa
   base ya tenia las 10 migraciones aplicadas de antes).

7. **`BullModule.forRoot()` sin soporte de password/TLS -- corregido.**
   Solo armaba la conexion con `REDIS_HOST`/`REDIS_PORT` sueltos, sin
   `password` -- suficiente para el Redis local de Docker (sin auth),
   pero el Redis administrado de Render ("Key Value") la exige.
   Se agrego `apps/backend/src/common/config/redis-connection.util.ts`
   (`getRedisConnectionOptions()`): si existe `REDIS_URL` (formato
   `redis[s]://[:password@]host:port`) se usa directo -- bullmq arma
   el cliente de `ioredis` a partir de esa URL, respetando `rediss://`
   para TLS sin config adicional; si no existe, arma la conexion como
   antes con `REDIS_HOST`/`REDIS_PORT`, sumando `REDIS_PASSWORD` si
   esta definida. El entorno local (sin ninguna de las tres) sigue
   funcionando igual que antes.

8. **Lista completa y final de variables de entorno para el backend en
   Render:**

   | Variable | Obligatoria | Para que | Notas |
   |---|---|---|---|
   | `DATABASE_URL` | Si | Conexion de TypeORM a Postgres, rol `app_user` | El SSL se detecta solo (punto 6) -- no hace falta agregar `?ssl=true` a la URL. Usar la password nueva rotada con `set-prod-role-password.js` (punto 5), no `devpassword_app`. |
   | `REDIS_URL` | Si (o las 3 de abajo) | Conexion de BullMQ/ioredis a Redis, con password | Usar la connection string que da Render ("Key Value"). Alternativa: `REDIS_HOST` + `REDIS_PORT` + `REDIS_PASSWORD` por separado (punto 7). |
   | `JWT_SECRET` | Si | Firma de los JWT del login del dashboard | Debe ser un secreto propio de produccion, distinto al de desarrollo. |
   | `ENCRYPTION_KEY` | Si | Cifrado AES-256-GCM de credenciales (`CryptoService`) | Hex de 32 bytes (64 caracteres), `openssl rand -hex 32`. Si se migran datos ya cifrados desde desarrollo, tiene que ser la MISMA key usada para cifrarlos -- si no, no van a poder desencriptarse nunca mas. Si la base de Render arranca vacia, se puede generar una nueva. |
   | `ANTHROPIC_API_KEY` | Si | Llamadas a Claude (`ClaudeService`) | |
   | `VOYAGE_API_KEY` | Si | Embeddings para RAG (`VoyageService`) | De la cuenta independiente `dash.voyageai.com`, NO la key de "AI Models" de MongoDB Atlas (ver seccion 6). |
   | `WHATSAPP_VERIFY_TOKEN` | Si | Handshake de verificacion del webhook con Meta | Cualquier texto propio; tiene que coincidir con el que se configure en Meta (Graph API Explorer / App dashboard). |
   | `SENTRY_DSN` | No (recomendada) | DSN del proyecto de Sentry (`instrument.ts`) | Si se deja vacia, el SDK arranca en modo no-op: no manda nada, pero no rompe el arranque. Ver seccion 9. |
   | `PORT` | No | Puerto en el que escucha el backend (`main.ts`) | Render lo inyecta solo para servicios web -- no hace falta declararlo a mano; si se declara igual, no pasa nada porque el fallback es el mismo mecanismo (`process.env.PORT`). |
   | `ADMIN_DATABASE_URL` | No (no la lee el backend en runtime) | Rol admin para correr migraciones (`db/scripts/migrate.js`) y los demas scripts de `db/scripts/` | No es una variable del servicio backend en Render -- hace falta tenerla a mano (en el `.env` local, apuntando a la base de Render) para correr las migraciones contra esa base la primera vez, y para `set-prod-role-password.js`. |

   Las credenciales de WhatsApp por tenant (`access_token`, etc.) NO son
   variables de entorno -- viven cifradas en la tabla
   `whatsapp_credentials`, cargadas con `set-whatsapp-token.js` u
   `onboard-tenant.js`.

## 9. Observabilidad basica (Fase 4, antes de sumar mas features)

Con Fase 1-3 completas y probadas en produccion, antes de seguir sumando
funcionalidad se sumo observabilidad minima al backend: saber cuando algo
se rompe (Sentry) y poder chequear si el servicio esta realmente sano
(`/health`), no solo si el proceso sigue vivo.

1. **Sentry -- SDK oficial de NestJS, no un paquete de comunidad.**
   Se instalo `@sentry/nestjs` (la documentacion vigente esta en
   `docs.sentry.io/platforms/javascript/guides/nestjs/` -- se consulto en
   vivo para esta integracion en vez de asumir una API vieja, porque
   Sentry cambio su recomendacion oficial para Nest mas de una vez;
   paquetes de comunidad como `nestjs-sentry`/`nest-raven` estan
   descontinuados y no se usaron).
   - `apps/backend/src/instrument.ts` (nuevo): carga el `.env` a mano
     con `dotenv.config()` (mismos paths que `ConfigModule.forRoot()`)
     y RECIEN despues llama a `Sentry.init({ dsn: process.env.SENTRY_DSN,
     tracesSampleRate: 1.0 })`. El `dotenv.config()` manual es
     necesario -- ver bug #19 en la seccion 4 -- porque este archivo se
     importa antes que `AppModule`/`ConfigModule`, asi que sin el, el
     DSN todavia no existiria en `process.env` en el momento del
     `Sentry.init()`. Si `SENTRY_DSN` sigue sin definirse despues de
     cargar el `.env`, el SDK arranca en modo no-op -- no manda nada,
     pero tampoco rompe el arranque en local.
   - `apps/backend/src/main.ts`: `import './instrument'` como la
     PRIMERA linea del archivo, antes que cualquier otro import --
     requisito del SDK para poder instrumentar el resto de las
     librerias al cargarse.
   - `apps/backend/src/app.module.ts`: `SentryModule.forRoot()` como el
     primer import del modulo, y `SentryGlobalFilter` como el primer
     `APP_FILTER` (antes del `TenantInterceptor`, que es un
     `APP_INTERCEPTOR` distinto) -- captura cualquier excepcion no
     manejada del ciclo HTTP y la manda a Sentry antes de devolver la
     respuesta de error al cliente.
   - **El Worker de BullMQ necesita captura manual -- confirmado, no
     asumido.** `WhatsappIncomingProcessor` corre fuera de cualquier
     request HTTP (la misma razon de fondo del bug #16), asi que la
     instrumentacion automatica de Sentry para Nest -- pensada para el
     ciclo de vida de un request -- NO lo cubre sola. Se investigo la
     documentacion de integraciones de Sentry en vivo y se confirmo:
     no existe integracion automatica para BullMQ/Bull. Se agrego
     `Sentry.captureException(error)` a mano dentro del
     `@OnWorkerEvent('failed')` que ya existia en
     `whatsapp-incoming.processor.ts`, solo en la rama de fallo
     DEFINITIVO (cuando `job.attemptsMade >= maxAttempts`, la misma
     rama que ya logueaba `logger.error` en vez de `logger.warn`) --
     los reintentos intermedios no generan ruido en Sentry, solo el
     que ya se rindio y necesita que alguien lo mire. Envuelto en
     `Sentry.withIsolationScope()` (recomendacion oficial para jobs de
     background) con el contexto del job (queue, jobId, attemptsMade,
     jobData) para que un evento no contamine el scope de otro job que
     se procese despues en el mismo Worker.

2. **`GET /health` -- chequeo real de Postgres y Redis, no solo
   "el proceso esta vivo".** Modulo nuevo `apps/backend/src/health/`
   (`HealthModule` + `HealthController`), sin `@nestjs/terminus` --
   con solo dos chequeos y sin ningun indicador built-in de Terminus
   para Redis (hay que escribir uno a mano de todos modos), un
   controller simple resulto mas directo que sumar la dependencia.
   - Postgres: `dataSource.query('SELECT 1')` via el `DataSource` de
     TypeORM (ya global gracias a `TypeOrmCoreModule`, que Nest marca
     `@Global()` internamente -- no hizo falta reimportar
     `TypeOrmModule`).
   - Redis: se reutiliza la MISMA conexion que ya usa BullMQ para la
     cola `whatsapp-incoming`, inyectando la `Queue` (`@InjectQueue`) y
     llamando a `(await queue.client).info()` -- se probo `ping()`
     primero, pero la interfaz `IRedisClient` que expone bullmq (para
     poder soportar tambien node-redis y el Redis nativo de Bun, no
     solo ioredis) no la declara; `info()` si esta declarada y fuerza
     el mismo viaje de ida y vuelta real a Redis. Para esto,
     `whatsapp.module.ts` ahora exporta `BullModule` (`exports:
     [BullModule]`) y `HealthModule` importa `WhatsappModule` -- evita
     abrir una segunda conexion a Redis solo para el healthcheck.
   - Cada chequeo corre con su propio timeout de 3 segundos
     (`Promise.race`): si Postgres o Redis estan realmente caidos (no
     solo lentos), el driver puede quedarse reintentando en silencio en
     vez de fallar rapido -- sin este limite, `/health` podria colgarse
     indefinidamente en vez de reportar el error.
   - Si cualquiera de los dos falla, responde `503 Service Unavailable`
     con el detalle de cual fallo y por que -- nunca `200` a medias.
   - **Probado real, parando y levantando los contenedores de Docker a
     mano** (no solo revisando el codigo): con Redis parado, `/health`
     devolvio `503` con `redis: { status: "error", message: "Timeout
     tras 3000ms" }` y `postgres: "ok"`; al levantar Redis de nuevo,
     `/health` tardo unos segundos en volver a `200` (el tiempo que
     tarda el cliente ioredis interno en reconectar solo, con su propio
     backoff -- comportamiento esperado, no un bug). Mismo resultado
     simetrico parando/levantando Postgres.

3. **Prueba real de que los errores llegan a Sentry -- CONFIRMADO, en
   el dashboard de verdad, tras encontrar y corregir un bug en el
   camino.** Se agrego temporalmente un endpoint de prueba
   (`GET /test/http-error`, que lanzaba una excepcion sincrona en un
   controller) y una forma de forzar un fallo DEFINITIVO del Worker
   (`GET /test/worker-error`, que encolaba un job con `attempts: 1` y
   una bandera que hacia que `WhatsappIncomingProcessor.process()`
   lanzara un error a proposito, sin tocar `WhatsappService` ni pegarle
   a Meta/Claude de verdad). **Primer intento**: ambos errores se
   dispararon y quedaron en el log del backend, pero en Sentry solo
   aparecio el issue de ejemplo que el propio Sentry crea al armar el
   proyecto -- los dos de prueba no llegaron. Investigado y corregido
   (bug #19 en la seccion 4): `instrument.ts` inicializaba Sentry ANTES
   de que `ConfigModule` cargara el `.env`, asi que `SENTRY_DSN` estaba
   vacio en ese momento y el SDK quedo en modo no-op sin avisar.
   **Segundo intento, ya con el fix**: mismos dos errores forzados de
   nuevo (mensaje cambiado a "REINTENTO 2" para distinguirlos de
   cualquier resto del primer intento) -- el usuario confirmo en el
   dashboard de Sentry que esta vez SI aparecieron los dos issues.
   Todo el codigo de prueba (`_test-trigger.controller.ts`, la bandera
   `__forceTestError` en el processor, y su registro en
   `whatsapp.module.ts`) se elimino del repo despues -- no queda ningun
   endpoint de prueba.

4. **Variables de entorno nuevas**: `SENTRY_DSN` agregada a
   `.env.example` (vacia, como el resto de las keys de servicios
   externos) y a la tabla de variables de Render (seccion 8, punto 8) --
   opcional mas no esta de mas: si se deja vacia, Sentry simplemente no
   manda nada.

5. **Dependencias nuevas del backend**: `@sentry/nestjs` (el SDK) y
   `dotenv` -- esta ultima ya era una dependencia transitiva (via
   `@nestjs/config`), pero se agrego como dependencia DIRECTA del
   `package.json` de `apps/backend` porque ahora `instrument.ts` la usa
   explicitamente (mismo criterio que ya se aplico antes con `pg` en la
   raiz del repo, ver bug #15 en la seccion 4: si el codigo la importa
   de verdad, tiene que estar declarada, no solo colgar de otro paquete).
