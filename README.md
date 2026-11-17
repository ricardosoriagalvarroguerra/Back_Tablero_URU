# API · Tablero Inteligente URU

Backend **Fastify + TypeScript + `pg`** que sirve los módulos del tablero desde la
BDR PostgreSQL `uruguay`.

- Sin paso de build: Node ≥ 22 ejecuta TypeScript directamente (type-stripping).
- Cada endpoint devuelve JSON ya con la forma que consumen los componentes React
  (ver `../src/api.ts`).

## Correr

```bash
cd server
npm install
cp .env.example .env        # ajustar DATABASE_URL si hace falta
npm run dev                 # http://localhost:5174 (con --watch)
npm run typecheck
```

Requiere la BDR creada y poblada (el esquema/seed `db/` vive en el repo del
frontend, **Front_Tablero_URU**).

## Aprovisionamiento automático de la BDR

Al arrancar, la API compara el hash de `db/schema.sql` + `db/seed.sql` con la tabla
`seed_meta`. Si cambió (o la base está vacía), aplica schema + seed **en una sola
transacción** con advisory lock; si algo falla hace ROLLBACK y sigue sirviendo los datos
anteriores. `GET /api/health` informa la versión cargada (`seed.version`).

- `db/` se copia desde el repo **Front_Tablero_URU** (fuente de verdad): `npm run sync:db`.
- Para desactivarlo: `DB_AUTO_SEED=false`.
- La base del tablero se deriva íntegramente del seed: reaplicarlo reemplaza todo su contenido.

## Ingesta automática (v0.9)

`src/ingest/` tiene un módulo por fuente; cada corrida queda en `ingesta_corridas` y actualiza
`fuente_estado` con el resultado real.

| Fuente | Qué trae | Destino |
|---|---|---|
| `bcu` | dólar interbancario, últimos 15 días (web service SOAP de cotizaciones) | `indicador_observaciones` · `tipo_cambio` (UPSERT + delta) |
| `imf` | FMI WEO 2015–2027 para ARG BOL BRA CHL COL ECU PER PRY URY | `region_observaciones` |

- `npm run ingest [fuente]` — corrida única (para el **cron de Railway**: servicio aparte con el mismo
  repo, start command `npm run ingest`, schedule diario, p. ej. `17 11 * * *`).
- `POST /api/ingesta[?fuente=bcu]` con `Authorization: Bearer $INGEST_TOKEN` (503 si no hay token
  configurado, 401 si no coincide). `GET /api/ingesta` lista las últimas corridas.
- Al arrancar la API corre una ingesta en segundo plano después del seed (`INGEST_ON_BOOT=false` la apaga).

> El parser del BCU y el del FMI se probaron contra respuestas simuladas con la forma documentada de cada
> servicio; si el BCU devuelve otra moneda o grupo, ajustar `BCU_MONEDA` / `BCU_GRUPO`.

## Endpoints v0.9

| Ruta | Devuelve |
|---|---|
| `GET /api/region` | `{ vintage, paises, indicadores, datos: { [indicador]: { [iso]: [{anio, valor, proyeccion}] } } }` |
| `GET /api/alertas` | `[{ id, nivel: 'alta'|'media'|'info', titulo, detalle, indicador, valor, umbral }]` (reglas en `src/alertas.ts`) |
| `GET /api/indicadores` | además: `fecha` (ISO del último dato) y `periodicidad` (frescura, `src/frescura.ts`) |

## Despliegue en Railway

Railway autodetecta el proyecto Node y corre `npm start`
(`node --env-file-if-exists=.env src/index.ts`). Variables de entorno a setear en
el servicio:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | referencia a la BDR PostgreSQL de Railway (usar la URL **interna** `postgres.railway.internal`; para conexión pública/SSL agregar `?sslmode=require`) |
| `PORT` | lo inyecta Railway automáticamente (el server escucha en `process.env.PORT`) |
| `HOST` | `0.0.0.0` (default) |
| `DB_AUTO_SEED` | opcional; `false` desactiva el auto-aprovisionamiento |
| `INGEST_TOKEN` | secreto para `POST /api/ingesta` (sin él, el endpoint queda deshabilitado) |
| `INGEST_ON_BOOT` | opcional; `false` evita la ingesta al arrancar |
| `BCU_MONEDA` / `BCU_GRUPO` | opcionales (default `2225` / `0`) |
| `CORS_ORIGIN` | URL pública del frontend (p.ej. `https://front-tablero-uru.up.railway.app`) |

> **No commitear** credenciales: `.env` está en `.gitignore`; en Railway se cargan
> como variables del servicio.

## Endpoints

| Método y ruta | Módulo | Devuelve |
|---|---|---|
| `GET /api/health` | — | ping a la BDR |
| `GET /api/indicadores` | A | KPIs (valor, delta, extra, spark 12m + `periodos`) |
| `GET /api/indicadores/:codigo` | A | + serie histórica completa |
| `GET /api/agro` | AG | productos del complejo, novillo, faena, destinos |
| `GET /api/mercados` | C | UBI, bonos (USD/UYU/UI), SSLB, grado inversor, ratings |
| `GET /api/actividad` | AC | PIB, industria, IPC, departamentos, social |
| `GET /api/energia` | EN | matriz renovable, exportación, combustibles, H2 |
| `GET /api/externo` | EX | balanza, destinos, turismo, IED, deuda, commodities |
| `GET /api/fiscal` | F$ | resultado global/primario, regla fiscal, deuda, recaudación, TPM, reservas, expectativas |
| `GET /api/noticias?tag=` | D | feed (filtrable) |
| `GET /api/noticias/:codigo` | D | cuerpo + términos + vínculos |
| `GET /api/eventos` | E | calendario próximos 30 días |
| `GET /api/fuentes` | F | estado/latencia de cada fuente |
| `GET /api/search?q=` | — | búsqueda full-text (noticias) + ILIKE (indicadores) |
| `GET /api/analisis` | Z | capa analítica vigente (tesis, semáforo, proyecciones, escenarios, riesgos, lecturas) |

## Estructura

```
server/src/
├── index.ts        # bootstrap Fastify + CORS + health + registro de rutas
├── env.ts          # config desde entorno
├── db.ts           # pool pg + helpers query/one
├── repo.ts         # acceso a los almacenes genéricos metricas/series
├── format.ts       # helpers de formato
└── routes/         # un archivo por módulo (agro, mercados, actividad,
                    #   energia, externo, fiscal, indicadores, noticias,
                    #   eventos, fuentes, analisis) + search
```

El frontend ([`../src/useDashboardData.ts`](../src/useDashboardData.ts)) cae a los
datos embebidos si la API está caída; el footer indica el origen.
