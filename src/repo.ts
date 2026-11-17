// Acceso a los almacenes genéricos metricas/series.

import { query } from './db.ts';

export interface MetricaRow {
  clave: string;
  valor: number | null;
  valor_texto: string | null;
  unidad: string | null;
  asof: string | null;
  fuente: string | null;
  nota: string | null;
}

export type MetricaMap = Record<string, MetricaRow>;

/** Carga todas las métricas de un módulo en un mapa clave→fila. */
export async function loadMetricas(modulo: string): Promise<MetricaMap> {
  const rows = await query<MetricaRow>(
    `SELECT clave, valor, valor_texto, unidad, asof, fuente, nota FROM metricas WHERE modulo = $1`,
    [modulo],
  );
  return Object.fromEntries(rows.map((r) => [r.clave, r]));
}

/** Serie (sparkline) de un módulo/clave, ordenada por idx. */
export async function loadSerie(modulo: string, clave: string): Promise<number[]> {
  const rows = await query<{ valor: number }>(
    `SELECT valor FROM series WHERE modulo = $1 AND clave = $2 ORDER BY idx`,
    [modulo, clave],
  );
  return rows.map((r) => r.valor);
}

/** Serie con su etiqueta de período por punto (eje X de los gráficos). */
export async function loadSerieConPeriodos(
  modulo: string,
  clave: string,
): Promise<{ valores: number[]; periodos: string[] | undefined }> {
  const rows = await query<{ valor: number; periodo: string | null }>(
    `SELECT valor, periodo FROM series WHERE modulo = $1 AND clave = $2 ORDER BY idx`,
    [modulo, clave],
  );
  const periodos = rows.map((r) => r.periodo);
  return {
    valores: rows.map((r) => r.valor),
    periodos: periodos.every((x) => x != null) && periodos.length ? (periodos as string[]) : undefined,
  };
}

/** Helpers para leer valores de un MetricaMap. */
export const valOf = (m: MetricaMap, k: string): number | null => m[k]?.valor ?? null;
export const txtOf = (m: MetricaMap, k: string): string => m[k]?.valor_texto ?? '';
export const asofOf = (m: MetricaMap, k: string): string => m[k]?.asof ?? '';
export const srcOf = (m: MetricaMap, k: string): string => m[k]?.fuente ?? '';
export const notaOf = (m: MetricaMap, k: string): string => m[k]?.nota ?? '';
