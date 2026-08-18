# dashboard (Next.js)

Panel del cliente: conectar WhatsApp, subir documentos, ver
conversaciones. Se desarrolla en paralelo a la Fase 1.

## Para inicializarlo

```bash
cd apps
npx create-next-app@latest dashboard --typescript --tailwind --app
```

## Consumo de la API

Cada llamada al backend debe incluir el JWT (con el tenant_id ya
embebido) en el header `Authorization: Bearer <token>`. El dashboard
nunca le pide al usuario elegir un tenant a mano para hacer una
llamada -- el backend ya lo resuelve por el TenantInterceptor a
partir del token.
