// Módulo Mercados — crédito soberano (UBI, bonos, SSLB, ratings).

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { loadMetricas, valOf, txtOf } from '../repo.ts';

const PERSPECTIVA: Record<string, string> = {
  positiva: 'Positivo',
  estable: 'Estable',
  negativa: 'Negativo',
  en_revision: 'En revisión',
  na: '—',
};

async function indice(codigo: string): Promise<{ series: number[]; value: number; chg: number }> {
  const rows = await query<{ valor: number; variacion: number | null }>(
    `SELECT io.valor, io.variacion
       FROM indice_riesgo_observaciones io JOIN indices_riesgo i ON i.id = io.indice_id
      WHERE i.codigo = $1 ORDER BY io.fecha`,
    [codigo],
  );
  const last = rows.at(-1);
  return { series: rows.map((r) => r.valor), value: last?.valor ?? 0, chg: last?.variacion ?? 0 };
}

export function registerMercados(app: FastifyInstance): void {
  app.get('/api/mercados', async () => {
    const [ubi, bonos, ratings, m] = await Promise.all([
      indice('UBI'),
      query<{ codigo: string; nombre: string; moneda: string; tipo: string; vencimiento: string | null; precio: number | null; rendimiento: number | null; variacion: number | null }>(
        `SELECT codigo, nombre, moneda, tipo, vencimiento, precio, rendimiento, variacion
           FROM v_bonos_actuales ORDER BY orden`,
      ),
      query<{ agencia: string; calificacion: string; perspectiva: string; fecha: string }>(
        `SELECT agencia, calificacion, perspectiva, fecha FROM v_calificaciones_actuales`,
      ),
      loadMetricas('mercados'),
    ]);

    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mesAnio = (d: string | null) => {
      if (!d) return '';
      const date = new Date(d);
      return `${MESES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    };
    // ordena ratings por agencia preferida (S&P, Moody's, Fitch, DBRS, resto)
    const PREF = ['S&P', "Moody's", 'Fitch', 'DBRS'];
    const sortedRatings = [...ratings].sort(
      (a, b) => (PREF.indexOf(a.agencia) + 1 || 99) - (PREF.indexOf(b.agencia) + 1 || 99),
    );

    const sslbNota = txtOf(m, 'sslb_nota');

    return {
      ubi: { value: ubi.value, chg: ubi.chg, series: ubi.series },
      bonos: bonos.map((b) => ({
        id: b.codigo,
        name: b.nombre,
        moneda: b.moneda,
        price: b.precio,
        yield: b.rendimiento,
        tipo: b.tipo,
        chg: b.variacion,
        vencimiento: b.vencimiento ?? undefined,
      })),
      gradoInversor: { agencias: valOf(m, 'grado_agencias') ?? 0, nota: txtOf(m, 'grado_nota') },
      sslb: sslbNota
        ? {
            nota: sslbNota,
            cupon: txtOf(m, 'sslb_cupon'),
            kpi1: txtOf(m, 'sslb_kpi1'),
            kpi2: txtOf(m, 'sslb_kpi2'),
          }
        : null,
      ratings: sortedRatings.map((r) => ({
        agencia: r.agencia,
        rating: r.calificacion,
        outlook: PERSPECTIVA[r.perspectiva] ?? r.perspectiva,
        actualizado: mesAnio(r.fecha),
      })),
    };
  });
}
