// Comparador regional (FMI WEO). Agnóstico del país: sirve lo que haya en
// `region_observaciones` con la forma común de los tableros BOL/URU.

import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';

export const PAISES: { iso: string; nombre: string }[] = [
  { iso: 'ARG', nombre: 'Argentina' }, { iso: 'BOL', nombre: 'Bolivia' }, { iso: 'BRA', nombre: 'Brasil' },
  { iso: 'CHL', nombre: 'Chile' }, { iso: 'COL', nombre: 'Colombia' }, { iso: 'ECU', nombre: 'Ecuador' },
  { iso: 'PER', nombre: 'Perú' }, { iso: 'PRY', nombre: 'Paraguay' }, { iso: 'URY', nombre: 'Uruguay' },
];

export const INDICADORES: { id: string; label: string; unidad: string; polaridad: 'up' | 'down' }[] = [
  { id: 'NGDP_RPCH', label: 'Crecimiento del PIB', unidad: '%', polaridad: 'up' },
  { id: 'PCPIEPCH', label: 'Inflación (fin de período)', unidad: '%', polaridad: 'down' },
  { id: 'GGXWDG_NGDP', label: 'Deuda bruta del gobierno', unidad: '% PIB', polaridad: 'down' },
  { id: 'GGXCNL_NGDP', label: 'Resultado fiscal', unidad: '% PIB', polaridad: 'up' },
  { id: 'BCA_NGDPD', label: 'Cuenta corriente', unidad: '% PIB', polaridad: 'up' },
  { id: 'LUR', label: 'Desempleo', unidad: '%', polaridad: 'down' },
];

export function registerRegion(app: FastifyInstance): void {
  app.get('/api/region', async () => {
    const rows = await query<{ pais: string; indicador: string; anio: number; valor: number; proyeccion: boolean; vintage: string | null }>(
      `SELECT pais, indicador, anio, valor, proyeccion, vintage FROM region_observaciones ORDER BY indicador, pais, anio`,
    );
    const datos: Record<string, Record<string, { anio: number; valor: number; proyeccion: boolean }[]>> = {};
    for (const r of rows) {
      ((datos[r.indicador] ??= {})[r.pais] ??= []).push({ anio: r.anio, valor: r.valor, proyeccion: r.proyeccion });
    }
    return {
      vintage: rows.find((r) => r.vintage)?.vintage ?? null,
      paises: PAISES,
      indicadores: INDICADORES,
      datos,
    };
  });
}
