// ============================================================
// Prueba automatizada del aislamiento por tenant (Row-Level Security).
//
// Convierte en codigo la misma secuencia que se probo a mano: lectura
// sin contexto, lectura con contexto, y un intento de escritura cruzada.
//
// Requiere (en la raiz del proyecto): npm install pg dotenv --save-dev
// Se corre con:                       node --test db/tests/rls.test.js
// (el test runner viene incluido en Node 18+, no hace falta instalar Jest)
// ============================================================

require('dotenv').config();

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

// whatsapp_saas: rol admin, usado SOLO para preparar y limpiar los datos
// de la prueba (como un seed real). NUNCA se usa para las aserciones de
// aislamiento -- ese rol se salta RLS por ser superusuario.
const ADMIN_URL =
  process.env.ADMIN_DATABASE_URL ||
  'postgresql://whatsapp_saas:devpassword@localhost:5432/whatsapp_saas_dev';

// app_user: el rol de aplicacion real, sujeto a RLS. Con este se hacen
// TODAS las verificaciones de aislamiento.
const APP_URL =
  process.env.DATABASE_URL ||
  'postgresql://app_user:devpassword_app@localhost:5432/whatsapp_saas_dev';

// UUIDs nuevos en cada corrida: la prueba nunca choca con datos
// existentes (ni con el seed manual) y se puede repetir sin limpiar nada a mano.
const tenantA = randomUUID();
const tenantB = randomUUID();

let adminClient;
let appClient;

async function setTenant(client, tenantId) {
  await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
}

before(async () => {
  adminClient = new Client({ connectionString: ADMIN_URL });
  appClient = new Client({ connectionString: APP_URL });
  await adminClient.connect();
  await appClient.connect();

  await adminClient.query(
    `INSERT INTO tenants (id, name, slug) VALUES ($1, 'RLS Test A', $2), ($3, 'RLS Test B', $4)`,
    [tenantA, `rls-test-a-${tenantA.slice(0, 8)}`, tenantB, `rls-test-b-${tenantB.slice(0, 8)}`],
  );
  await adminClient.query(
    `INSERT INTO contacts (tenant_id, wa_id, display_name) VALUES ($1, '50000000001', 'RLS Contact A'), ($2, '50000000002', 'RLS Contact B')`,
    [tenantA, tenantB],
  );
});

after(async () => {
  // Borrar el tenant borra en cascada sus contactos -- limpia solo,
  // sin dejar basura para la proxima corrida.
  await adminClient.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
  await adminClient.end();
  await appClient.end();
});

test('sin contexto de tenant, no se ve ningun contacto de prueba', async () => {
  // Conexion NUEVA a proposito: nunca llamo set_config, simula
  // exactamente "una peticion que llego sin pasar por el interceptor".
  const freshClient = new Client({ connectionString: APP_URL });
  await freshClient.connect();
  try {
    const { rows } = await freshClient.query(
      `SELECT * FROM contacts WHERE tenant_id IN ($1, $2)`,
      [tenantA, tenantB],
    );
    assert.equal(rows.length, 0);
  } finally {
    await freshClient.end();
  }
});

test('con el tenant A activo, solo se ve el contacto de A', async () => {
  await setTenant(appClient, tenantA);
  const { rows } = await appClient.query(
    `SELECT * FROM contacts WHERE tenant_id IN ($1, $2)`,
    [tenantA, tenantB],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].display_name, 'RLS Contact A');
});

test('con el tenant B activo, solo se ve el contacto de B', async () => {
  await setTenant(appClient, tenantB);
  const { rows } = await appClient.query(
    `SELECT * FROM contacts WHERE tenant_id IN ($1, $2)`,
    [tenantA, tenantB],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].display_name, 'RLS Contact B');
});

test('un INSERT cruzado (tenant A escribiendo en tenant B) debe fallar', async () => {
  await setTenant(appClient, tenantA);
  await assert.rejects(
    () =>
      appClient.query(
        `INSERT INTO contacts (tenant_id, wa_id, display_name) VALUES ($1, '50000000099', 'Intento Cruzado')`,
        [tenantB],
      ),
    (err) => {
      assert.match(err.message, /row-level security/i);
      return true;
    },
  );
});

test('un tenant no ve la fila de otro tenant en la tabla tenants', async () => {
  await setTenant(appClient, tenantA);
  const { rows } = await appClient.query(`SELECT * FROM tenants WHERE id IN ($1, $2)`, [
    tenantA,
    tenantB,
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, tenantA);
});
