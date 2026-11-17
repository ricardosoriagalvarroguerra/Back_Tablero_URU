// Fuente BCU: dólar interbancario desde el web service público de cotizaciones
// (SOAP «awsbcucotizaciones»). Trae los últimos 15 días y hace UPSERT en el
// indicador `tipo_cambio`.
//
//   BCU_WS_URL  endpoint (default: servicio público del BCU)
//   BCU_MONEDA  código de moneda del BCU (default 2225: dólar USA billete)
//   BCU_GRUPO   grupo de cotizaciones (default 0)

import type { FuenteIngesta } from './tipos.ts';
import { fetchTexto, isoHoy, isoMenosDias, etiquetaDia, upsertObservaciones } from './util.ts';

const URL_WS = process.env.BCU_WS_URL ?? 'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones';
const MONEDA = process.env.BCU_MONEDA ?? '2225';
const GRUPO = process.env.BCU_GRUPO ?? '0';

function sobre(desde: string, hasta: string): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">
  <soapenv:Header/>
  <soapenv:Body>
    <cot:wsbcucotizaciones.Execute>
      <cot:Entrada>
        <cot:Moneda><cot:item>${MONEDA}</cot:item></cot:Moneda>
        <cot:FechaDesde>${desde}</cot:FechaDesde>
        <cot:FechaHasta>${hasta}</cot:FechaHasta>
        <cot:Grupo>${GRUPO}</cot:Grupo>
      </cot:Entrada>
    </cot:wsbcucotizaciones.Execute>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Extrae {fecha, valor} de cada <datoscotizaciones.dato> (tolera prefijos de namespace). */
export function parseCotizaciones(xml: string): { fecha: string; valor: number }[] {
  const tag = (bloque: string, nombre: string) =>
    bloque.match(new RegExp(`<(?:\\w+:)?${nombre}>([^<]*)</(?:\\w+:)?${nombre}>`))?.[1]?.trim();
  const bloques = xml.split(/<(?:\w+:)?datoscotizaciones\.dato>/).slice(1);
  const out: { fecha: string; valor: number }[] = [];
  for (const b of bloques) {
    const fecha = tag(b, 'Fecha');
    const valor = Number(tag(b, 'TCV') ?? tag(b, 'TCC'));
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && Number.isFinite(valor) && valor > 0) out.push({ fecha, valor });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const fuenteBcu: FuenteIngesta = {
  codigo: 'bcu',
  async run(client) {
    const xml = await fetchTexto(URL_WS, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'Cotizaaction/AWSBCUCOTIZACIONES.Execute' },
      body: sobre(isoMenosDias(15), isoHoy()),
    });
    const datos = parseCotizaciones(xml);
    if (!datos.length) return { estado: 'error', filas: 0, mensaje: 'respuesta sin cotizaciones (revisar BCU_MONEDA/BCU_GRUPO)' };
    const filas = await upsertObservaciones(
      client,
      'tipo_cambio',
      datos.map((d) => ({ ...d, periodo: etiquetaDia(d.fecha) })),
    );
    const ultimo = datos[datos.length - 1];
    return {
      estado: filas ? 'ok' : 'sin_cambios',
      filas,
      mensaje: `${datos.length} cotizaciones; último ${ultimo.fecha} = ${ultimo.valor}`,
      ultima: etiquetaDia(ultimo.fecha).replace('-', ' '),
    };
  },
};
