import { Injectable } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Cifrado simetrico AES-256-GCM para las columnas *_encrypted
 * (access_token_encrypted en whatsapp_credentials,
 * credentials_encrypted en tenant_integrations).
 *
 * DEV: la llave sale de una variable de entorno (ENCRYPTION_KEY,
 * 32 bytes en hex -> generar con `openssl rand -hex 32`).
 *
 * PRODUCCION: reemplazar por "envelope encryption" real -- una
 * llave maestra en AWS KMS / GCP KMS que cifra una data-key por
 * tenant; esta clase pasaria a recibir la data-key ya descifrada
 * en vez de leer una unica llave de entorno. La interfaz publica
 * (encrypt/decrypt) no cambiaria, por eso vale la pena aislarla
 * en un service desde el dia uno.
 */
@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Empaquetamos iv + authTag + ciphertext en un solo valor base64
    // que es justamente lo que se guarda en la columna *_encrypted.
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  decrypt(encoded: string): string {
    const data = Buffer.from(encoded, 'base64');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
