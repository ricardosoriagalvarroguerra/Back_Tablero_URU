// Módulo Externo & comercio — commodities, balanza, destinos, turismo, IED, deuda.

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { loadMetricas, valOf, txtOf, asofOf, srcOf, notaOf } from '../repo.ts';

interface CommodityRow {
  codigo: string;
  nombre: string;
  unidad: string;
  valor: number;
  var_mensual: number | null;
  var_anual: number | null;
  polaridad: 'up' | 'down' | 'none';
  fuente: string | null;
  asof: string | null;
  nota: string | null;
}

export function registerExterno(app: FastifyInstance): void {
  app.get('/api/externo', async () => {
    const [commodities, destinos, m] = await Promise.all([
      query<CommodityRow>(`SELECT * FROM commodities ORDER BY id`),
      query<{ pais: string; valor: number }>(`SELECT pais, valor FROM comercio_destinos ORDER BY orden`),
      loadMetricas('externo'),
    ]);

    return {
      commodities: commodities.map((c) => ({
        id: c.codigo,
        label: c.nombre,
        value: c.valor,
        unit: c.unidad,
        chgMensual: c.var_mensual,
        chgAnual: c.var_anual,
        polarity: c.polaridad,
        source: c.fuente,
        asof: c.asof,
        nota: c.nota ?? undefined,
      })),
      balanza: {
        exportaciones: valOf(m, 'balanza_export'),
        importaciones: valOf(m, 'balanza_import'),
        saldo: valOf(m, 'balanza_saldo'),
        periodo: txtOf(m, 'balanza_periodo') || asofOf(m, 'balanza_export'),
        source: srcOf(m, 'balanza_export'),
      },
      destinos: destinos.map((d) => ({ pais: d.pais, valor: d.valor })),
      turismo: {
        ingresosUsd: valOf(m, 'turismo_ingresos'),
        visitantes: valOf(m, 'turismo_visitantes'),
        saldoUsd: valOf(m, 'turismo_saldo'),
        nota: notaOf(m, 'turismo_ingresos'),
        asof: asofOf(m, 'turismo_ingresos'),
        source: srcOf(m, 'turismo_ingresos'),
      },
      ied: {
        valorUsd: valOf(m, 'ied_valor'),
        pctPib: valOf(m, 'ied_pctpib'),
        asof: asofOf(m, 'ied_valor'),
        source: srcOf(m, 'ied_valor'),
      },
      cuentaCorriente: {
        pctPib: valOf(m, 'cc_pct'),
        periodo: txtOf(m, 'cc_periodo') || asofOf(m, 'cc_pct'),
        source: srcOf(m, 'cc_pct'),
      },
      competitividad: {
        tcrBrecha: valOf(m, 'tcr_brecha'),
        tcrNota: notaOf(m, 'tcr_brecha'),
        ipfFrontera: valOf(m, 'ipf_frontera'),
        ipfNota: notaOf(m, 'ipf_frontera'),
        asof: asofOf(m, 'tcr_brecha'),
        source: srcOf(m, 'tcr_brecha'),
      },
      deuda: {
        brutaPct: valOf(m, 'deuda_bruta_pct'),
        totalUsd: valOf(m, 'deuda_total_usd'),
        asof: asofOf(m, 'deuda_bruta_pct'),
        source: srcOf(m, 'deuda_bruta_pct'),
      },
    };
  });
}
