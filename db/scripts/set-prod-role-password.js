#!/usr/bin/env node
/**
 * Cambia la contraseña del rol de aplicacion (app_user) en una base de
 * datos dada -- pensado para produccion (Render), donde hoy app_user
 * todavia tiene la misma contraseña hardcodeada en la migracion
 * 007_rls_policies.sql (`devpassword_app`), no adecuada para una base
 * expuesta a internet.
 *
 * A diferencia de los demas scripts de db/scripts/, este NO lee
 * ADMIN_DATABASE_URL del .env: la URL de conexion admin y la
 * contraseña nueva se pasan por argumento a proposito, para no
 * depender de (ni pisar) las variables de entorno de desarrollo local.
 *
 * Despues de correrlo hay que actualizar DATABASE_URL en las variables
 * de entorno del backend en Render con la contraseña nueva.
 *
 * Uso: node db/scripts/set-prod-role-password.js <admin_connection_url> <nueva_password>
 */
const { Client } = require('pg');
const { getPgSslConfig } = require('../lib/pg-ssl');

const [, , adminUrl, newPassword] = process.argv;
if (!adminUrl || !newPassword) {
  console.error(
    'Uso: node db/scripts/set-prod-role-password.js <admin_connection_url> <nueva_password>',
  );
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: adminUrl, ssl: getPgSslConfig(adminUrl) });
  await client.connect();

  try {
    await client.query(`ALTER ROLE app_user WITH PASSWORD ${client.escapeLiteral(newPassword)}`);
    console.log('Contraseña de app_user actualizada.');
    console.log(
      'No te olvides de actualizar DATABASE_URL con la contraseña nueva en las variables de entorno del backend en Render.',
    );
  } finally {
    await client.end();
  }
}

run();
