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

## Despliegue en Railway

Railway autodetecta el proyecto Node y corre `npm start`
(`node --env-file-if-exists=.env src/index.ts`). Variables de entorno a setear en
el servicio:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | referencia a la BDR PostgreSQL de Railway (usar la URL **interna** `postgres.railway.internal`; para conexión pública/SSL agregar `?sslmode=require`) |
| `PORT` | lo inyecta Railway automáticamente (el server escucha en `process.env.PORT`) |
| `HOST` | `0.0.0.0` (default) |
| `CORS_ORIGIN` | URL pública del frontend (p.ej. `https://front-tablero-uru.up.railway.app`) |

> **No commitear** credenciales: `.env` está en `.gitignore`; en Railway se cargan
> como variables del servicio.

## Endpoints

| Método y ruta | Módulo | Devuelve |
|---|---|---|
| `GET /api/health` | — | ping a la BDR |
| `GET /api/indicadores` | A | KPIs (valor, delta, extra, spark 12m) |
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
                    #   eventos, fuentes) + search
```

El frontend ([`../src/useDashboardData.ts`](../src/useDashboardData.ts)) cae a los
datos embebidos si la API está caída; el footer indica el origen.
