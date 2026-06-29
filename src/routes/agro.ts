// Módulo Agro — complejo agroexportador (módulo estrella).

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { loadMetricas, valOf, txtOf, asofOf, srcOf } from '../repo.ts';

interface ProductoRow {
  codigo: string;
  nombre: string;
  precio: number | null;
  precio_unidad: string | null;
  var_precio: number | null;
  export_usd: number | null;
  participacion: number | null;
  destino_top: string | null;
  polaridad: 'up' | 'down' | 'none';
  asof: string | null;
  fuente: string | null;
  nota: string | null;
  spark: number[] | null;
}

export function registerAgro(app: FastifyInstance): void {
  app.get('/api/agro', async () => {
    const [productos, destinos, m] = await Promise.all([
      query<ProductoRow>(`SELECT * FROM v_productos_agro`),
      query<{ pais: string; valor: number }>(`SELECT pais, valor FROM agro_destinos ORDER BY orden`),
      loadMetricas('agro'),
    ]);

    return {
      productos: productos.map((p) => ({
        id: p.codigo,
        nombre: p.nombre,
        precio: p.precio,
        precioUnidad: p.precio_unidad ?? '',
        varPrecio: p.var_precio,
        exportUsd: p.export_usd,
        participacion: p.participacion,
        destinoTop: p.destino_top ?? '',
        spark: p.spark ?? [],
        polaridad: p.polaridad,
        asof: p.asof ?? '',
        fuente: p.fuente ?? '',
        nota: p.nota ?? undefined,
      })),
      exportTotalAgro: valOf(m, 'export_total'),
      participacionAgro: valOf(m, 'participacion'),
      novilloPrecio: valOf(m, 'novillo_precio'),
      novilloVar: valOf(m, 'novillo_var'),
      faena: valOf(m, 'faena'),
      faenaPeriodo: txtOf(m, 'faena_periodo'),
      destinos: destinos.map((d) => ({ pais: d.pais, valor: d.valor })),
      asof: asofOf(m, 'resumen') || asofOf(m, 'export_total'),
      fuente: srcOf(m, 'resumen') || srcOf(m, 'export_total'),
      resumen: txtOf(m, 'resumen'),
    };
  });
}
