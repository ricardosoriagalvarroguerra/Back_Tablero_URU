// Módulo Actividad & precios.

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { loadMetricas, loadSerieConPeriodos, valOf, txtOf, asofOf, srcOf } from '../repo.ts';

export function registerActividad(app: FastifyInstance): void {
  app.get('/api/actividad', async () => {
    const [m, pibSerie, rubros, sectores, departamentos] = await Promise.all([
      loadMetricas('actividad'),
      loadSerieConPeriodos('actividad', 'pib'),
      query<{ label: string; valor: number }>(`SELECT label, valor FROM ipc_rubros ORDER BY orden`),
      query<{ label: string; valor: number }>(`SELECT label, valor FROM pib_sectores ORDER BY orden`),
      query<{ codigo: string; nombre: string; zona: string | null; valor: number | null; valor_alt: number | null }>(
        `SELECT codigo, nombre, zona, valor, valor_alt FROM v_actividad_departamental`,
      ),
    ]);

    return {
      pib: {
        varInteranual: valOf(m, 'pib_var_interanual'),
        anual2025: valOf(m, 'pib_anual2025'),
        trimestral: valOf(m, 'pib_trimestral'),
        series: pibSerie.valores,
        periodos: pibSerie.periodos,
        asof: asofOf(m, 'pib_var_interanual'),
        source: srcOf(m, 'pib_var_interanual'),
      },
      industria: {
        varInteranual: valOf(m, 'industria_var_interanual'),
        varMensual: valOf(m, 'industria_var_mensual'),
        asof: asofOf(m, 'industria_var_interanual'),
        source: srcOf(m, 'industria_var_interanual'),
      },
      pibSectores: sectores.map((s) => ({ label: s.label, value: s.valor })),
      ipcRubros: rubros.map((r) => ({ label: r.label, value: r.valor })),
      departamentos: departamentos.map((d) => ({
        codigo: d.codigo,
        nombre: d.nombre,
        zona: d.zona ?? '',
        valor: d.valor,
        valorAlt: d.valor_alt,
      })),
      social: {
        desempleo: valOf(m, 'social_desempleo'),
        desempleoPeriodo: txtOf(m, 'social_desempleo_periodo'),
        empleo: valOf(m, 'social_empleo'),
        salarioReal: valOf(m, 'social_salario_real'),
        salarioRealPeriodo: txtOf(m, 'social_salario_real_periodo'),
        pobreza: valOf(m, 'social_pobreza'),
        pobrezaPeriodo: txtOf(m, 'social_pobreza_periodo'),
        source: srcOf(m, 'social_desempleo'),
      },
    };
  });
}
