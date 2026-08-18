# Token permanente de WhatsApp (System User) -- como generarlo

El token que usamos hasta ahora (el que te da el "API Setup" rapido de
Meta) es temporal y vence cada 24 horas -- por eso hay que volver a
pegarlo en `.env` / correr `set-whatsapp-token.js` todos los dias. Para
no depender de eso, Meta permite generar un token que **no vence**,
atado a un "System User" (una cuenta de servicio, no una persona) en
vez de a tu usuario personal.

Esto es un tramite manual en el Business Manager de Meta -- no se
puede hacer por API (para crear el primer System User hace falta un
humano logueado en el navegador). Una vez generado el token, se guarda
igual que el temporal: cifrado en `whatsapp_credentials` via
`set-whatsapp-token.js` (o el nuevo `onboard-tenant.js` para un tenant
nuevo).

## Pasos

1. Ir a [Business Settings](https://business.facebook.com/settings/) ->
   **Usuarios** -> **Usuarios del sistema** ("System Users").
2. Click en **+ Agregar**. Ponerle un nombre (ej. `whatsapp-saas-bot`)
   y elegir el rol:
   - **Admin**: obtiene acceso automatico a todas las WABA del Business
     Manager. Mas simple para desarrollo.
   - **Employee**: hay que asignarle la WABA a mano despues. Mas
     acotado, mejor para produccion (principio de menor privilegio).
3. Con el System User creado, click en su nombre -> **Asignar activos**
   -> pestaña de tu App -> darle permiso **"Administrar app"**
   ("Manage app"). Si el rol es Employee, asignar tambien la WABA
   especifica con permiso de administrarla.
4. Recargar el panel de System Users y confirmar que el usuario
   muestra "Control total" sobre la App (puede tardar unos minutos en
   reflejarse).
5. Desde el mismo panel de asignacion de activos, click en
   **Generar token**. Elegir:
   - La App correspondiente.
   - **Expiracion del token: Nunca**.
   - Permisos: activar los tres --
     - `business_management`
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
6. Click en **Generar token** y copiarlo de inmediato -- **Meta lo
   muestra una sola vez**; si se pierde hay que generar uno nuevo (el
   anterior se puede revocar desde el mismo panel).
7. Guardarlo cifrado en la base, igual que el temporal:
   ```
   node db/scripts/set-whatsapp-token.js <phone_number_id> <token_permanente>
   ```
   (o pasarlo directo al onboardear un tenant nuevo con
   `onboard-tenant.js`, ver `ESTADO_DEL_PROYECTO.md` seccion 6).

## Notas

- El token de System User **no aparece nunca mas en la UI** despues de
  generado -- si se pierde antes de guardarlo cifrado, hay que
  revocarlo y generar otro (Business Settings -> System Users -> tu
  usuario -> "Generar nuevo token").
- Sigue siendo un secreto de texto plano hasta que se cifra con
  `CryptoService` / `set-whatsapp-token.js` -- no pegarlo en ningun
  archivo del repo, ni en el `.env` a largo plazo (solo de paso, si
  hace falta, y borrarlo despues de correr el script).
- Que el token no venza no significa que sea invulnerable: si se
  compromete, se revoca desde el mismo panel de System Users y se
  genera uno nuevo -- por eso igual conviene, mas adelante, rotarlo
  periodicamente en produccion.
- Este mismo token permanente sirve para **todos los numeros de
  telefono conectados a esa WABA** -- no hace falta un token distinto
  por numero, pero si vas a conectar un segundo negocio con su propia
  WABA (no solo otro numero dentro de la misma), necesita su propio
  System User o al menos que el existente tenga esa WABA asignada.

Fuentes: [Access Tokens Guide -- Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/), documentacion comunitaria contrastada (Meta no publica un tutorial unico y estable para este flujo, cambia de vez en cuando la UI de Business Settings).
