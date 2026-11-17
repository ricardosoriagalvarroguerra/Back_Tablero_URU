// Módulo A — Indicadores macro.

import type { FastifyInstance } from 'fastify';
import { query, one } from '../db.ts';
import { fechaCorta } from '../format.ts';

interface IndicadorRow {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string | null;
  categoria: string;
  sentido: 'pos' | 'neg' | 'neutral' | 'accent';
  decimales: number;
  definicion: string | null;
  asof: string | null;
  fuente: string | null;
  fecha_dato: string | null;
  valor: number | null;
  variacion: number | null;
  variacion_etiqueta: string | null;
  extra_label: string | null;
  extra_valor: string | null;
  extra_tono: 'pos' | 'neg' | 'neutral' | null;
  spark: number[] | null;
  periodos: (string | null)[] | null;
}

function toKpi(r: IndicadorRow) {
  return {
    id: r.codigo,
    label: r.nombre,
    value: r.valor,
    unit: r.unidad,
    categoria: r.categoria,
    sentiment: r.sentido,
    decimales: r.decimales,
    delta: r.variacion ?? 0,
    deltaLabel: r.variacion_etiqueta ?? '',
    spark: r.spark ?? [],
    // etiquetas de período alineadas con spark (sólo si están todas)
    periodos: r.periodos && r.periodos.every((p) => p != null) ? r.periodos : undefined,
    source: r.fuente,
    asof: r.asof ?? fechaCorta(r.fecha_dato),
    def: r.definicion,
    extra: r.extra_label
      ? { label: r.extra_label, value: r.extra_valor ?? '', tone: r.extra_tono ?? 'neutral' }
      : null,
  };
}

const SELECT_INDICADORES = `
  SELECT id, codigo, nombre, unidad, categoria, sentido, decimales, definicion, asof,
         fuente, fecha_dato, valor, variacion, variacion_etiqueta,
         extra_label, extra_valor, extra_tono, spark, periodos
  FROM v_indicadores_actuales
  ORDER BY id`;

export function registerIndicadores(app: FastifyInstance): void {
  app.get('/api/indicadores', async () => {
    const rows = await query<IndicadorRow>(SELECT_INDICADORES);
    return rows.map(toKpi);
  });

  app.get<{ Params: { codigo: string } }>('/api/indicadores/:codigo', async (req, reply) => {
    const { codigo } = req.params;
    const meta = await one<IndicadorRow>(
      SELECT_INDICADORES.replace('ORDER BY id', 'WHERE codigo = $1'),
      [codigo],
    );
    if (!meta) return reply.code(404).send({ error: 'indicador no encontrado' });
    const serie = await query<{ fecha: string; valor: number; periodo: string | null }>(
      `SELECT io.fecha, io.valor, io.periodo
         FROM indicador_observaciones io JOIN indicadores i ON i.id = io.indicador_id
        WHERE i.codigo = $1 ORDER BY io.fecha`,
      [codigo],
    );
    return { ...toKpi(meta), serie };
  });
}
