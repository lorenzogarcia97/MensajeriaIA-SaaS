#!/usr/bin/env node
/**
 * Conecta un negocio (tenant) nuevo de punta a punta: crea el tenant,
 * su usuario dueño (login del dashboard) y sus credenciales de
 * WhatsApp (token cifrado con el MISMO algoritmo que CryptoService),
 * y de paso suscribe la App al WABA por Graph API -- el paso manual
 * documentado como bug #9 en ESTADO_DEL_PROYECTO.md
 * (`POST /{WABA_ID}/subscribed_apps`).
 *
 * No reemplaza los pasos manuales en Meta (crear la App/WABA/numero de
 * prueba se hace en el navegador) -- una vez que tenés esos datos a
 * mano, este script hace todo lo demas por API/SQL.
 *
 * Uso:
 *   node db/scripts/onboard-tenant.js <config.json>
 *
 * Ver db/scripts/onboard-tenant.example.json para el formato.
 */
require('dotenv').config();

const fs = require('fs');
const bcrypt = require('bcrypt');
const { randomBytes, createCipheriv } = require('crypto');
const { Client } = require('pg');

const GRAPH_API_VERSION = 'v23.0';
const BCRYPT_ROUNDS = 12;

function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function loadConfig(configPath) {
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const required = [
    ['tenant', 'name'],
    ['tenant', 'slug'],
    ['owner', 'email'],
    ['owner', 'password'],
    ['whatsapp', 'wabaId'],
    ['whatsapp', 'phoneNumberId'],
    ['whatsapp', 'accessToken'],
  ];
  for (const [section, field] of required) {
    if (!raw[section] || !raw[section][field]) {
      throw new Error(`Falta "${section}.${field}" en ${configPath}`);
    }
  }
  return raw;
}

async function subscribeAppToWaba(wabaId, accessToken) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Meta respondio ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function run() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error('Uso: node db/scripts/onboard-tenant.js <config.json>');
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error('Falta ENCRYPTION_KEY en el .env');
    process.exit(1);
  }

  const config = loadConfig(configPath);
  const ADMIN_URL =
    process.env.ADMIN_DATABASE_URL ||
    'postgresql://whatsapp_saas:devpassword@localhost:5432/whatsapp_saas_dev';

  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();

  let tenantId;
  try {
    await client.query('BEGIN');

    const tenantRows = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      [config.tenant.name, config.tenant.slug],
    );
    tenantId = tenantRows.rows[0].id;

    const passwordHash = await bcrypt.hash(config.owner.password, BCRYPT_ROUNDS);
    await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'owner', $4)`,
      [tenantId, config.owner.email, passwordHash, config.owner.fullName || null],
    );

    const encryptedToken = encrypt(config.whatsapp.accessToken, process.env.ENCRYPTION_KEY);
    const webhookVerifyToken =
      config.whatsapp.webhookVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || '';
    await client.query(
      `INSERT INTO whatsapp_credentials
         (tenant_id, waba_id, phone_number_id, display_phone_number, access_token_encrypted, webhook_verify_token, connection_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [
        tenantId,
        config.whatsapp.wabaId,
        config.whatsapp.phoneNumberId,
        config.whatsapp.displayPhoneNumber || null,
        encryptedToken,
        webhookVerifyToken,
      ],
    );

    await client.query('COMMIT');
    console.log(`Tenant "${config.tenant.name}" creado (${tenantId}), con su usuario dueno y credenciales guardadas (pending).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando el tenant -- no se guardo nada:', err.message);
    await client.end();
    process.exit(1);
  }

  try {
    console.log(`Suscribiendo la App al WABA ${config.whatsapp.wabaId} por Graph API...`);
    await subscribeAppToWaba(config.whatsapp.wabaId, config.whatsapp.accessToken);
    await client.query(
      `UPDATE whatsapp_credentials SET connection_status = 'connected', connected_at = now() WHERE tenant_id = $1`,
      [tenantId],
    );
    console.log('Suscripcion OK -- connection_status = connected.');
  } catch (err) {
    console.error(
      `No se pudo suscribir automaticamente (queda en "pending"): ${err.message}\n` +
        `Podes hacerlo a mano en Graph API Explorer (POST /${config.whatsapp.wabaId}/subscribed_apps) ` +
        `y despues correr:\n` +
        `  UPDATE whatsapp_credentials SET connection_status = 'connected', connected_at = now() WHERE tenant_id = '${tenantId}';`,
    );
  }

  await client.end();
  console.log(
    `\nListo. Login del dashboard: ${config.owner.email} / (la password del config.json)\n` +
      `Verifica el estado con: SELECT * FROM whatsapp_credentials WHERE tenant_id = '${tenantId}';`,
  );
}

run();
