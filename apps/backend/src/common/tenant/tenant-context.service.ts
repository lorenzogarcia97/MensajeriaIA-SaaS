import { Injectable, Scope } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

/**
 * Contenedor del estado de tenant PARA UN SOLO REQUEST.
 *
 * Scope.REQUEST hace que Nest cree una instancia nueva por cada
 * peticion HTTP (y la destruya al terminar). Es el mecanismo que
 * permite que dos requests concurrentes de dos tenants distintos
 * nunca compartan ni pisen su QueryRunner/transaccion.
 *
 * Trade-off consciente: los providers REQUEST-scoped tienen un
 * costo de performance mayor que los Singleton (Nest reconstruye
 * el sub-arbol de DI en cada request). Para el volumen del MVP es
 * aceptable; si mas adelante se vuelve un cuello de botella medido
 * (no supuesto), la alternativa es migrar a AsyncLocalStorage
 * (ej. con la libreria nestjs-cls) manteniendo el mismo contrato.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private queryRunner: QueryRunner | null = null;
  private tenantId: string | null = null;

  setQueryRunner(qr: QueryRunner): void {
    this.queryRunner = qr;
  }

  setTenantId(id: string): void {
    this.tenantId = id;
  }

  getTenantId(): string {
    if (!this.tenantId) {
      throw new Error('No hay tenant activo en el contexto de este request.');
    }
    return this.tenantId;
  }

  /**
   * EntityManager transaccional del request actual. Todo acceso a
   * datos de negocio (conversations, messages, knowledge_chunks...)
   * DEBE pasar por aqui, nunca por el DataSource "pelado", para
   * quedar dentro de la transaccion donde se seteo el tenant_id
   * via set_config() -- y por lo tanto, dentro del alcance de RLS.
   */
  get manager() {
    if (!this.queryRunner) {
      throw new Error(
        'No hay una transaccion de tenant activa. ' +
          'Este servicio se esta usando fuera del ciclo del TenantInterceptor.',
      );
    }
    return this.queryRunner.manager;
  }
}
