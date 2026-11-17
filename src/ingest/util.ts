// Utilidades de la ingesta: fetch con timeout, fechas y upsert de observaciones.

import type pg from 'pg';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-11-13' → '13-nov' */
export const etiquetaDia = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}-${MESES[m - 1]}`;
};
/** '2026-11-13' → '13 nov' (formato de `asof`) */
export const asofDia = (iso: string) => etiquetaDia(iso).replace('-', ' ');

export const isoHoy = (d = new Date()) => d.toISOString().slice(0, 10);
export const isoMenosDias = (dias: number, d = new Date()) => isoHoy(new Date(d.getTime() - dias * 86_400_000));

export async function fetchTexto(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<string> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

/**
 * UPSERT de observaciones de un indicador (ON CONFLICT indicador+fecha) y
 * recálculo del delta del último dato (% vs el anterior). Devuelve las filas
 * insertadas o modificadas.
 */
export async function upsertObservaciones(
  client: pg.PoolClient,
  codigo: string,
  obs: { fecha: string; valor: number; periodo: string }[],
  opciones: { deltaPct?: boolean } = { deltaPct: true },
): Promise<number> {
  let filas = 0;
  for (const o of obs) {
    const r = await client.query(
      `INSERT INTO indicador_observaciones (indicador_id, fecha, valor, periodo)
       VALUES ((SELECT id FROM indicadores WHERE codigo = $1), $2, $3, $4)
       ON CONFLICT (indicador_id, fecha) DO UPDATE
         SET valor = EXCLUDED.valor, periodo = EXCLUDED.periodo
         WHERE indicador_observaciones.valor IS DISTINCT FROM EXCLUDED.valor`,
      [codigo, o.fecha, o.valor, o.periodo],
    );
    filas += r.rowCount ?? 0;
  }
  if (filas === 0) return 0;

  // delta del último dato vs el anterior
  const ult = await client.query<{ id: number; fecha: string; valor: number }>(
    `SELECT io.id, to_char(io.fecha, 'YYYY-MM-DD') AS fecha, io.valor
       FROM indicador_observaciones io JOIN indicadores i ON i.id = io.indicador_id
      WHERE i.codigo = $1 ORDER BY io.fecha DESC LIMIT 2`,
    [codigo],
  );
  const [a, b] = ult.rows;
  if (a && b && opciones.deltaPct !== false) {
    const pct = (Number(a.valor) / Number(b.valor) - 1) * 100;
    const etiqueta = `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1).replace('.', ',')}%`;
    await client.query(`UPDATE indicador_observaciones SET variacion = $1, variacion_etiqueta = $2 WHERE id = $3`, [
      Number(pct.toFixed(4)),
      etiqueta,
      a.id,
    ]);
  }
  if (a) await client.query(`UPDATE indicadores SET asof = $1 WHERE codigo = $2`, [asofDia(a.fecha), codigo]);
  return filas;
}
