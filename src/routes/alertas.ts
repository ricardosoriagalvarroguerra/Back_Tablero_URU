// Alertas: reglas explícitas (src/alertas.ts) evaluadas sobre los datos vigentes.

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { evaluarAlertas } from '../alertas.ts';

export function registerAlertas(app: FastifyInstance): void {
  app.get('/api/alertas', async () => {
    const rows = await query<{
      codigo: string; nombre: string; valor: number | null; spark: number[] | null;
      periodos: (string | null)[] | null; fecha: string | null; periodicidad: string;
    }>(
      `SELECT codigo, nombre, valor, spark, periodos, to_char(fecha_dato, 'YYYY-MM-DD') AS fecha, periodicidad::text
         FROM v_indicadores_actuales`,
    );
    return evaluarAlertas(
      rows
        .filter((r) => r.valor != null)
        .map((r) => ({
          id: r.codigo,
          label: r.nombre,
          value: Number(r.valor),
          spark: r.spark ?? undefined,
          periodos: r.periodos?.every((p) => p != null) ? (r.periodos as string[]) : undefined,
          fecha: r.fecha,
          periodicidad: r.periodicidad,
        })),
    );
  });
}
