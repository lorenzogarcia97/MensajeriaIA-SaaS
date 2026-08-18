# ai-service (FastAPI)

Se desarrolla en la Fase 2 del roadmap (RAG) -- ver el documento de
arquitectura, seccion 4.

## Para inicializarlo

```bash
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" pydantic-settings
```

## Responsabilidades (cuando se implemente)

- Pipeline de ingesta y chunking de documentos (seccion 4.1)
- Motor RAG: busqueda semantica en pgvector, siempre filtrada por tenant_id
- Loop de tool-calling con Claude (orquestador conversacional)

## Contrato con el backend

El backend (NestJS) ya resolvio el tenant_id via el TenantInterceptor
antes de invocar a este servicio, y se lo pasa explicitamente en cada
request. Este servicio JAMAS decide el tenant por su cuenta -- lo
recibe siempre como parametro obligatorio.
