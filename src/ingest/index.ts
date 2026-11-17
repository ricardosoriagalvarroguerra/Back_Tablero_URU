// Orquestador de la ingesta: corre cada fuente en su propia transacción, deja
// constancia en `ingesta_corridas` y actualiza `fuente_estado` con el resultado
// real (estado, latencia y último dato). Una fuente que falla no frena a las demás.

import { pool } from '../db.ts';
import type { FuenteIngesta, ResultadoFuente } from './tipos.ts';
import { fuenteBcu } from './bcu.ts';
import { fuenteImf } from './imf.ts';

export const FUENTES_INGESTA: FuenteIngesta[] = [fuenteBcu, fuenteImf];

export interface ResumenCorrida extends ResultadoFuente {
  fuente: string;
  ms: number;
}

type Log = { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void };
const consola: Log = { info: (o, m) => console.log(m ?? '', o), warn: (o, m) => console.warn(m ?? '', o) };

export async function runIngest(log: Log = consola, soloFuente?: string): Promise<ResumenCorrida[]> {
  const fuentes = FUENTES_INGESTA.filter((f) => !soloFuente || f.codigo === soloFuente);
  const resumen: ResumenCorrida[] = [];
  for (const f of fuentes) {
    const client = await pool.connect();
    const t0 = Date.now();
    let res: ResultadoFuente;
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO ingesta_corridas (fuente, estado) VALUES ($1, 'sin_cambios') RETURNING id`,
      [f.codigo],
    );
    const corridaId = rows[0].id;
    try {
      await client.query('BEGIN');
      res = await f.run(client);
      await client.query(res.estado === 'error' ? 'ROLLBACK' : 'COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      res = { estado: 'error', filas: 0, mensaje: (err as Error).message.slice(0, 500) };
    }
    const ms = Date.now() - t0;
    try {
      await client.query(
        `UPDATE ingesta_corridas SET fin = now(), estado = $2, filas = $3, mensaje = $4 WHERE id = $1`,
        [corridaId, res.estado, res.filas, res.mensaje],
      );
      // estado de la fuente según la corrida real
      const estado = res.estado === 'error' ? 'down' : res.estado === 'ok' ? 'live' : 'ok';
      await client.query(
        `INSERT INTO fuente_estado (fuente_id, estado, latencia_ms, ultima_actualizacion)
         SELECT id, $2::estado_fuente, $3,
                COALESCE($4, (SELECT ultima_actualizacion FROM v_fuentes_estado_actual WHERE codigo = $1))
           FROM fuentes WHERE codigo = $1`,
        [f.codigo, estado, ms, res.ultima ?? null],
      );
    } finally {
      client.release();
    }
    if (res.estado === 'error') log.warn({ fuente: f.codigo, ...res, ms }, 'ingesta');
    else log.info({ fuente: f.codigo, ...res, ms }, 'ingesta');
    resumen.push({ fuente: f.codigo, ...res, ms });
  }
  return resumen;
}
