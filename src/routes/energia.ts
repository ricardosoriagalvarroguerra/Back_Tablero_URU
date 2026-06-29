// Módulo Energía — matriz renovable.

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { loadMetricas, valOf, txtOf, asofOf, srcOf, notaOf } from '../repo.ts';

export function registerEnergia(app: FastifyInstance): void {
  app.get('/api/energia', async () => {
    const [matriz, combustibles, m] = await Promise.all([
      query<{ codigo: string; nombre: string; pct: number }>(
        `SELECT codigo, nombre, pct FROM energia_matriz ORDER BY orden`,
      ),
      query<{ producto: string; precio: number | null; unidad: string | null }>(
        `SELECT producto, precio, unidad FROM energia_combustibles ORDER BY orden`,
      ),
      loadMetricas('energia'),
    ]);

    return {
      matriz: matriz.map((f) => ({ id: f.codigo, nombre: f.nombre, pct: f.pct })),
      renovablePct: valOf(m, 'renovable_pct'),
      demandaMax: valOf(m, 'demanda_max'),
      potenciaInstalada: valOf(m, 'potencia_instalada'),
      exportacion: {
        destino: txtOf(m, 'exportacion_destino'),
        valorGwh: valOf(m, 'exportacion_gwh'),
        nota: notaOf(m, 'exportacion_gwh'),
      },
      combustibles: combustibles.map((c) => ({
        producto: c.producto,
        precio: c.precio,
        unidad: c.unidad ?? '',
      })),
      hidrogeno: {
        proyecto: txtOf(m, 'hidrogeno_proyecto'),
        inversionUsd: valOf(m, 'hidrogeno_inversion'),
        estado: txtOf(m, 'hidrogeno_estado'),
        nota: notaOf(m, 'hidrogeno_inversion'),
      },
      asof: asofOf(m, 'resumen') || asofOf(m, 'renovable_pct'),
      source: srcOf(m, 'resumen') || srcOf(m, 'renovable_pct'),
      resumen: txtOf(m, 'resumen'),
    };
  });
}
