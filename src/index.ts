// Tablero Inteligente URU — API (Fastify + pg).
// Sirve los módulos del tablero desde las tablas/vistas de la BDR PostgreSQL `uruguay`.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './env.ts';
import { pool, one } from './db.ts';
import { registerIndicadores } from './routes/indicadores.ts';
import { registerAgro } from './routes/agro.ts';
import { registerMercados } from './routes/mercados.ts';
import { registerActividad } from './routes/actividad.ts';
import { registerEnergia } from './routes/energia.ts';
import { registerExterno } from './routes/externo.ts';
import { registerFiscal } from './routes/fiscal.ts';
import { registerNoticias } from './routes/noticias.ts';
import { registerEventos } from './routes/eventos.ts';
import { registerFuentes } from './routes/fuentes.ts';
import { registerSearch } from './routes/search.ts';
import { registerAnalisis } from './routes/analisis.ts';

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });

app.get('/api/health', async () => {
  const row = await one<{ now: string }>('SELECT now() AS now');
  return { ok: true, db: row != null, time: row?.now };
});

registerIndicadores(app);
registerAgro(app);
registerMercados(app);
registerActividad(app);
registerEnergia(app);
registerExterno(app);
registerFiscal(app);
registerNoticias(app);
registerEventos(app);
registerFuentes(app);
registerSearch(app);
registerAnalisis(app);

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
