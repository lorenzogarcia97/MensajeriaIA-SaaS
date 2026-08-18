#!/usr/bin/env node
/**
 * Runner de migraciones. Cada archivo se auto-registra en
 * schema_migrations al final de su propio SQL -- por eso este script
 * ya NO necesita adivinar que esta aplicado y que no (esa logica
 * causaba un bug real: marcaba migraciones nuevas como aplicadas sin
 * haberlas corrido). La fuente de verdad es exclusivamente lo que
 * cada archivo escribe sobre si mismo cuando efectivamente corre.
 *
 * IMPORTANTE: usa ADMIN_DATABASE_URL, NO DATABASE_URL. Las migraciones
 * son operaciones de esquema que requieren el rol admin (whatsapp_saas).
 * DATABASE_URL le pertenece al backend (app_user), que a proposito no
 * tiene permiso para crear objetos nuevos en el schema.
 *
 * Requiere: npm install pg dotenv   (en la raiz del proyecto)
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { getPgSslConfig } = require('../lib/pg-ssl');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const ADMIN_URL =
  process.env.ADMIN_DATABASE_URL ||
  'postgresql://whatsapp_saas:devpassword@localhost:5432/whatsapp_saas_dev';

async function run() {
  const client = new Client({ connectionString: ADMIN_URL, ssl: getPgSslConfig(ADMIN_URL) });
  await client.connect();

  // Defensivo: por si alguien corre esto contra una base MUY vieja,
  // de antes de que existiera 000_schema_migrations_table.sql.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (rows.length > 0) {
      console.log(`- Saltando (ya aplicada): ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`> Aplicando: ${file}`);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      // Nota: el propio archivo .sql ya incluye su INSERT de
      // auto-registro al final -- no hace falta agregarlo aqui.
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error aplicando ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('Migraciones al dia.');
  await client.end();
}

run();
