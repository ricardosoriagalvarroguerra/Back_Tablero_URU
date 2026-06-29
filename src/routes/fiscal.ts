// Módulo Fiscal & monetario.

import type { FastifyInstance } from 'fastify';
import { loadMetricas, loadSerie, valOf, txtOf, asofOf, srcOf, notaOf } from '../repo.ts';

export function registerFiscal(app: FastifyInstance): void {
  app.get('/api/fiscal', async () => {
    const [m, globalSerie] = await Promise.all([
      loadMetricas('fiscal'),
      loadSerie('fiscal', 'result_global'),
    ]);

    const cumpleVal = valOf(m, 'regla_cumple');

    return {
      resultadoGlobal: {
        pctPib: valOf(m, 'result_global_pct'),
        periodo: txtOf(m, 'result_global_periodo'),
        series: globalSerie,
        source: srcOf(m, 'result_global_pct'),
      },
      resultadoPrimario: {
        pctPib: valOf(m, 'result_primario_pct'),
        periodo: txtOf(m, 'result_primario_periodo'),
        source: srcOf(m, 'result_primario_pct'),
      },
      reglaFiscal: {
        resultadoEstructural: valOf(m, 'regla_estructural'),
        topeGastoReal: valOf(m, 'regla_gasto'),
        deudaNetaTope: valOf(m, 'regla_deuda_tope'),
        cumple: cumpleVal == null ? null : cumpleVal === 1,
        nota: notaOf(m, 'regla_cumple'),
        source: srcOf(m, 'regla_estructural'),
      },
      deuda: {
        brutaPct: valOf(m, 'deuda_bruta_pct'),
        netaPct: valOf(m, 'deuda_neta_pct'),
        monedaLocalPct: valOf(m, 'deuda_moneda_local_pct'),
        asof: asofOf(m, 'deuda_bruta_pct'),
        source: srcOf(m, 'deuda_bruta_pct'),
      },
      recaudacion: {
        varRealInteranual: valOf(m, 'recaudacion_var_real'),
        periodo: txtOf(m, 'recaudacion_periodo'),
        source: srcOf(m, 'recaudacion_var_real'),
      },
      tasaPolitica: {
        valor: valOf(m, 'tasa_valor'),
        nombre: txtOf(m, 'tasa_nombre'),
        asof: asofOf(m, 'tasa_valor'),
        source: srcOf(m, 'tasa_valor'),
      },
      reservas: {
        valorUsd: valOf(m, 'reservas_valor'),
        asof: asofOf(m, 'reservas_valor'),
        source: srcOf(m, 'reservas_valor'),
      },
      expectativas: {
        inflacion12m: valOf(m, 'expect_12m'),
        inflacion24m: valOf(m, 'expect_24m'),
        asof: asofOf(m, 'expect_12m'),
        source: srcOf(m, 'expect_12m'),
      },
    };
  });
}
