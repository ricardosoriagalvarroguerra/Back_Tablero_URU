// Copia db/schema.sql y db/seed.sql desde el repo hermano Front_Tablero_URU
// (fuente de verdad del esquema y del seed). La API los aplica al arrancar
// si su hash cambió (src/bootstrap.ts).
//
//   npm run sync:db            (usa ../Front_Tablero_URU)
//   FRONT_DIR=/ruta npm run sync:db

import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const front = resolve(process.env.FRONT_DIR ?? resolve(root, '../Front_Tablero_URU'));
for (const f of ['schema.sql', 'seed.sql']) {
  const src = resolve(front, 'db', f);
  if (!existsSync(src)) throw new Error(`no existe ${src}`);
  copyFileSync(src, resolve(root, 'db', f));
  console.log(`✓ db/${f} ← ${src}`);
}
