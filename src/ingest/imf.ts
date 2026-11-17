// Fuente FMI: World Economic Outlook vía la API pública del DataMapper.
// Agnóstica del país: descarga cada indicador completo (la API ignora el filtro
// de países), filtra en el cliente y hace UPSERT en `region_observaciones`.

import type { FuenteIngesta } from './tipos.ts';
import { fetchTexto, isoHoy } from './util.ts';

const BASE = process.env.IMF_API_URL ?? 'https://www.imf.org/external/datamapper/api/v1';

export const PAISES_REGION = ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'PER', 'PRY', 'URY'] as const;
export const INDICADORES_REGION = ['NGDP_RPCH', 'PCPIEPCH', 'GGXWDG_NGDP', 'GGXCNL_NGDP', 'BCA_NGDPD', 'LUR'] as const;
export const ANIO_DESDE = 2015;
export const ANIO_HASTA = 2027;
/** Desde este año los valores del WEO son proyecciones. */
export const ANIO_PROYECCION = 2026;

type Payload = { values?: Record<string, Record<string, Record<string, number | null>>> };

export const fuenteImf: FuenteIngesta = {
  codigo: 'imf',
  async run(client) {
    const vintage = `FMI WEO · descargado ${isoHoy()}`;
    let filas = 0;
    let valores = 0;
    for (const ind of INDICADORES_REGION) {
      const texto = await fetchTexto(`${BASE}/${ind}`, {}, 30_000);
      if (texto.trimStart().startsWith('<')) throw new Error(`el FMI devolvió HTML en vez de JSON (${ind}): posible bloqueo`);
      const json = JSON.parse(texto) as Payload;
      const porPais = json.values?.[ind] ?? {};
      for (const iso of PAISES_REGION) {
        const serie = porPais[iso] ?? {};
        for (let anio = ANIO_DESDE; anio <= ANIO_HASTA; anio++) {
          const v = serie[String(anio)];
          if (v == null || !Number.isFinite(Number(v))) continue;
          valores++;
          const r = await client.query(
            `INSERT INTO region_observaciones (pais, indicador, anio, valor, proyeccion, vintage)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (pais, indicador, anio) DO UPDATE
               SET valor = EXCLUDED.valor, proyeccion = EXCLUDED.proyeccion, vintage = EXCLUDED.vintage
               WHERE region_observaciones.valor IS DISTINCT FROM EXCLUDED.valor
                  OR region_observaciones.proyeccion IS DISTINCT FROM EXCLUDED.proyeccion`,
            [iso, ind, anio, Number(Number(v).toFixed(4)), anio >= ANIO_PROYECCION, vintage],
          );
          filas += r.rowCount ?? 0;
        }
      }
    }
    if (!valores) return { estado: 'error', filas: 0, mensaje: 'el DataMapper no devolvió valores' };
    return {
      estado: filas ? 'ok' : 'sin_cambios',
      filas,
      mensaje: `${valores} valores (${INDICADORES_REGION.length} indicadores × ${PAISES_REGION.length} países)`,
      ultima: `WEO ${isoHoy()}`,
    };
  },
};
