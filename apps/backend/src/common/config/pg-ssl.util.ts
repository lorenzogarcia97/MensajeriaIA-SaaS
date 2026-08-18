/**
 * Config de SSL para la conexion de TypeORM a Postgres.
 *
 * Localhost/127.0.0.1 (Postgres de Docker en desarrollo) NO tiene SSL
 * configurado -- pedirlo ahi rompe la conexion. Cualquier otro host
 * (produccion, como el Postgres administrado de Render) SI lo exige --
 * conectarse sin SSL tira "error: SSL/TLS required". `rejectUnauthorized:
 * false` es el patron estandar para Render/Heroku: usan certificados que
 * no siempre encadenan a una CA publica conocida por Node.
 */
export function getPgSslConfig(
  connectionString: string | undefined,
): false | { rejectUnauthorized: false } {
  if (!connectionString) return false;
  const { hostname } = new URL(connectionString);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocal ? false : { rejectUnauthorized: false };
}
