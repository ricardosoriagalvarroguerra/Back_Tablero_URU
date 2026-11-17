// Ingesta bajo demanda.
//   POST /api/ingesta[?fuente=bcu]  Authorization: Bearer $INGEST_TOKEN
//     503 si INGEST_TOKEN no está definido · 401 si falta o no coincide.
//   GET  /api/ingesta               últimas corridas (público, sólo lectura).

import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { query } from '../db.ts';
import { runIngest } from '../ingest/index.ts';

function tokenValido(header: string | undefined, esperado: string): boolean {
  const m = header?.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

let enCurso = false;

export function registerIngesta(app: FastifyInstance): void {
  app.post<{ Querystring: { fuente?: string } }>('/api/ingesta', async (req, reply) => {
    const token = process.env.INGEST_TOKEN;
    if (!token) return reply.code(503).send({ error: 'ingesta deshabilitada: definir INGEST_TOKEN' });
    if (!tokenValido(req.headers.authorization, token)) return reply.code(401).send({ error: 'no autorizado' });
    if (enCurso) return reply.code(409).send({ error: 'ya hay una ingesta en curso' });
    enCurso = true;
    try {
      return { corridas: await runIngest(req.log, req.query.fuente) };
    } finally {
      enCurso = false;
    }
  });

  app.get('/api/ingesta', async () =>
    query(
      `SELECT id, fuente, inicio, fin, estado, filas, mensaje
         FROM ingesta_corridas ORDER BY inicio DESC LIMIT 20`,
    ),
  );
}
