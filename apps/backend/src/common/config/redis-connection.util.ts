import type { ConnectionOptions } from 'bullmq';

/**
 * Config de conexion a Redis para BullMQ.
 *
 * El Redis local de Docker no tiene password. El Redis administrado de
 * Render ("Key Value") si la exige. Si existe `REDIS_URL` (formato
 * `redis[s]://[:password@]host:port`) se usa directo -- bullmq arma el
 * cliente de ioredis a partir de ella, respetando `rediss://` para TLS
 * sin config adicional. Si no existe, se arma la conexion como hasta
 * ahora con host/puerto sueltos, mas `REDIS_PASSWORD` si esta definida,
 * para no romper el entorno local.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}
