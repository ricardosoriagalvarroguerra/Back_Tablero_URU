// `npm run ingest [fuente]` — corre la ingesta y termina (para el cron de Railway).

import { pool } from '../db.ts';
import { runIngest } from './index.ts';

const resumen = await runIngest(undefined, process.argv[2]);
await pool.end();
console.table(resumen.map(({ fuente, estado, filas, ms, mensaje }) => ({ fuente, estado, filas, ms, mensaje })));
process.exit(resumen.some((r) => r.estado === 'error') ? 1 : 0);
