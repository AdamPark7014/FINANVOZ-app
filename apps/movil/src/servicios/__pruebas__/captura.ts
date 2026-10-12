import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalogoEmbebido } from '../../captura/catalogo';
import type { OpcionesIngesta } from '../../captura/ingesta';
import type { NotificacionCruda } from '../../captura/tipos';

const FIXTURES = fileURLToPath(new URL('../../../../../fixtures', import.meta.url));

export const sha256Node = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export interface EjemploNotificacion {
  readonly id: string;
  readonly paquete: string;
  readonly titulo: string;
  readonly texto: string;
  readonly esperado: Record<string, unknown>;
}

/** `fixtures/notificaciones/<archivo>` tal cual. */
export function ejemplos(archivo = 'ejemplos.jsonl'): EjemploNotificacion[] {
  return readFileSync(`${FIXTURES}/notificaciones/${archivo}`, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as EjemploNotificacion);
}

/** 11 oct 2026 a las 10:00 en la Ciudad de México (UTC−6), como en `e-captura`. */
export const INICIO_E_CAPTURA = Date.UTC(2026, 9, 11, 16, 0);
export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;

/** La notificación cruda de un ejemplo, publicada en `cuando` (como la dejaría el servicio nativo). */
export function cruda(
  e: Pick<EjemploNotificacion, 'id' | 'paquete' | 'titulo' | 'texto'>,
  cuando: number,
): NotificacionCruda {
  return {
    clave: `0|${e.paquete}|1|${e.id}|10123`,
    etiqueta: null,
    paquete: e.paquete,
    titulo: e.titulo ?? '',
    texto: e.texto ?? '',
    publicada_en: cuando,
    cuando,
  };
}

/** Las 12 de `e-captura`: en orden de id, una por minuto desde las 10:00. */
export function colaECaptura(): NotificacionCruda[] {
  return ejemplos().map((e, i) => cruda(e, INICIO_E_CAPTURA + i * MINUTO));
}

export const opcionesPrueba: OpcionesIngesta = {
  catalogo: catalogoEmbebido(true),
  sha256: sha256Node,
  depuracion: false,
};
