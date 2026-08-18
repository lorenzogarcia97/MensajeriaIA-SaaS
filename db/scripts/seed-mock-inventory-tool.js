#!/usr/bin/env node
/**
 * Siembra una tenant_integrations + ai_tool de prueba para el flujo de
 * Tool Calling Dinamico (Fase 3): registra "check_stock" apuntando al
 * endpoint falso GET /mock-inventory/stock/:sku (levantado en el
 * propio backend, ver src/mock-inventory/) para Tienda Demo A -- sin
 * depender de un sistema de inventario real de terceros.
 *
 * Pensado para correr una sola vez (igual que dev_seed.sql): no es
 * idempotente, correrlo dos veces choca con la UNIQUE de ai_tools.
 *
 * Uso: node db/scripts/seed-mock-inventory-tool.js
 */
require('dotenv').config();

const { randomBytes, createCipheriv } = require('crypto');
const { Client } = require('pg');
const { getPgSslConfig } = require('../lib/pg-ssl');

function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

async function run() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('Falta ENCRYPTION_KEY en el .env');
    process.exit(1);
  }

  const ADMIN_URL =
    process.env.ADMIN_DATABASE_URL ||
    'postgresql://whatsapp_saas:devpassword@localhost:5432/whatsapp_saas_dev';

  const client = new Client({ connectionString: ADMIN_URL, ssl: getPgSslConfig(ADMIN_URL) });
  await client.connect();

  const tenantRows = await client.query(`SELECT id FROM tenants WHERE slug = 'tienda-demo-a'`);
  if (tenantRows.rows.length === 0) {
    console.error('No existe el tenant "tienda-demo-a" -- corre el seed primero (db/seeds/dev_seed.sql).');
    await client.end();
    process.exit(1);
  }
  const tenantId = tenantRows.rows[0].id;

  const credentials = JSON.stringify({ apiKey: 'mock-secret-key-123', headerName: 'X-API-Key' });
  const encryptedCredentials = encrypt(credentials, process.env.ENCRYPTION_KEY);

  const jsonSchema = JSON.stringify({
    type: 'object',
    properties: {
      producto: {
        type: 'string',
        description: 'Nombre corto del producto en minusculas, ej: taladro, martillo, cinta-metrica.',
      },
    },
    required: ['producto'],
  });

  try {
    await client.query('BEGIN');

    const integrationRows = await client.query(
      `INSERT INTO tenant_integrations
         (tenant_id, name, integration_type, base_url, auth_type, credentials_encrypted, status)
       VALUES ($1, 'Inventario Mock (prueba Fase 3)', 'rest_api', 'http://localhost:3001', 'api_key', $2, 'active')
       RETURNING id`,
      [tenantId, encryptedCredentials],
    );
    const integrationId = integrationRows.rows[0].id;

    await client.query(
      `INSERT INTO ai_tools
         (tenant_id, integration_id, tool_name, description, json_schema, endpoint_path, http_method, is_active)
       VALUES ($1, $2, 'check_stock', $3, $4::jsonb, '/mock-inventory/stock/{producto}', 'GET', true)`,
      [
        tenantId,
        integrationId,
        'Consulta el stock disponible de un producto del inventario de la tienda a partir de ' +
          'su nombre corto (ej: taladro, martillo, cinta-metrica). Usar cuando el cliente ' +
          'pregunte si hay stock o disponibilidad de un producto especifico.',
        jsonSchema,
      ],
    );

    await client.query('COMMIT');
    console.log(`Integracion "${integrationId}" y tool "check_stock" creadas para tenant ${tenantId}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error sembrando la integracion de prueba:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
