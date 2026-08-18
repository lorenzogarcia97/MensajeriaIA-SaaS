#!/usr/bin/env node
/**
 * Cifra un token de acceso de WhatsApp (AES-256-GCM, el MISMO
 * algoritmo que CryptoService en el backend) y lo guarda en
 * whatsapp_credentials -- reemplaza el valor PENDIENTE de prueba.
 *
 * Uso: node db/scripts/set-whatsapp-token.js <phone_number_id> <token>
 */
require('dotenv').config();
const { randomBytes, createCipheriv } = require('crypto');
const { Client } = require('pg');

function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

const [, , phoneNumberId, token] = process.argv;
if (!phoneNumberId || !token) {
  console.error('Uso: node db/scripts/set-whatsapp-token.js <phone_number_id> <token>');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error('Falta ENCRYPTION_KEY en el .env');
  process.exit(1);
}

const ADMIN_URL =
  process.env.ADMIN_DATABASE_URL ||
  'postgresql://whatsapp_saas:devpassword@localhost:5432/whatsapp_saas_dev';

async function run() {
  const encrypted = encrypt(token, process.env.ENCRYPTION_KEY);
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();

  const result = await client.query(
    `UPDATE whatsapp_credentials SET access_token_encrypted = $1, connection_status = 'connected'
     WHERE phone_number_id = $2 RETURNING tenant_id`,
    [encrypted, phoneNumberId],
  );

  if (result.rowCount === 0) {
    console.error('No se encontro ninguna fila con ese phone_number_id.');
  } else {
    console.log(`Token cifrado y guardado para el tenant ${result.rows[0].tenant_id}.`);
  }
  await client.end();
}

run();
