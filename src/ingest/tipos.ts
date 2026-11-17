// Contrato de una fuente de ingesta: descarga, guarda en la BDR y resume.

import type pg from 'pg';

export type EstadoCorrida = 'ok' | 'error' | 'sin_cambios';

export interface ResultadoFuente {
  estado: EstadoCorrida;
  filas: number;
  mensaje: string;
  /** Etiqueta del último dato disponible (para fuente_estado.ultima_actualizacion). */
  ultima?: string;
}

export interface FuenteIngesta {
  /** Código de la fuente en la tabla `fuentes` (bcu, imf, …). */
  codigo: string;
  run(client: pg.PoolClient): Promise<ResultadoFuente>;
}
