import { join } from 'path';
import * as dotenv from 'dotenv';
import * as Sentry from '@sentry/nestjs';

// Este archivo se importa ANTES que AppModule (ver main.ts), asi que
// ConfigModule.forRoot() todavia no corrio y process.env.SENTRY_DSN
// estaria vacio en este punto -- se carga el .env a mano, con los
// mismos dos paths (y el mismo orden) que usa ConfigModule.forRoot()
// en app.module.ts, para no depender de ese orden de arranque.
dotenv.config({ path: join(process.cwd(), '.env') });
dotenv.config({ path: join(process.cwd(), '..', '..', '.env') });

// Si SENTRY_DSN sigue vacio despues de esto, el SDK queda inicializado
// en modo no-op: no manda nada, pero tampoco rompe el arranque en local.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
