import { asc, count, eq, inArray } from 'drizzle-orm';
import { strFromU8, unzipSync } from 'fflate';
import { z } from 'zod';
import { ErrorDominio, type CfdiLeido, type EtiquetaCfdi } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { parsearCfdi, type CodigoErrorCfdi } from '@cartera/fiscal';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { enTransaccion, type Contexto } from './contexto';
import { miles } from './formato';

const { cfdi } = esquema;

/**
 * Importar facturas (M12, RF-FIS-01, `02 §24`, `05 §E13.1`): XML sueltos o ZIP (del portal del SAT o del
 * correo) que llegan por la hoja de compartir o por el selector de archivos. Cada XML pasa por `parsearCfdi`; el
 * UUID del timbre evita duplicados. El XML completo se guarda en la base cifrada (`04 §3.3`) y nunca sale a logs
 * ni a analítica (regla 9): ni montos, ni RFC, ni nombres, ni el contenido.
 */

/** Un archivo que la persona compartió o eligió: nombre (solo para decirle cuál no entró) y contenido. */
export interface ArchivoCfdi {
  readonly nombre: string;
  readonly bytes: Uint8Array;
}

/** Por qué un archivo no se importó: los códigos de `parsearCfdi` y los del propio archivo. */
export type MotivoRechazoCfdi =
  CodigoErrorCfdi | 'archivo_no_soportado' | 'zip_invalido' | 'demasiado_grande';

export interface RechazoCfdi {
  readonly archivo: string;
  readonly motivo: MotivoRechazoCfdi;
  /** Qué pasó y qué hacer, en lenguaje llano (`02 §14`). */
  readonly texto: string;
}

export interface ResultadoImportacion {
  readonly importadas: number;
  /** Ya estaban (mismo UUID): no se vuelven a guardar. */
  readonly repetidas: number;
  readonly rechazadas: readonly RechazoCfdi[];
  /** "Importé 8 facturas; 1 no es versión 4.0" (`02 §24`). */
  readonly resumen: string;
}

/** Tope de un XML suelto o dentro del ZIP (un CFDI pesa unos KB). */
export const TAMANO_MAXIMO_XML = 2 * 1024 * 1024;
/** Tope de un ZIP y de lo que trae descomprimido (evita archivos que se inflan sin fin). */
export const TAMANO_MAXIMO_ZIP = 50 * 1024 * 1024;
export const TAMANO_MAXIMO_DESCOMPRIMIDO = 200 * 1024 * 1024;
export const ARCHIVOS_MAXIMOS_ZIP = 5000;

/** Detalle de cada motivo (pendiente 95): qué pasó y, si se puede, qué hacer. */
export const TEXTO_RECHAZO: Readonly<Record<MotivoRechazoCfdi, string>> = {
  version_no_soportada:
    'Es una factura de una versión anterior (3.3). Solo leo facturas 4.0; pide a quien te la dio que la emita de nuevo.',
  sin_timbre: 'No trae el sello del SAT (el timbre), así que todavía no es una factura válida.',
  xml_invalido: 'El archivo está dañado o no es un XML. Descárgalo otra vez del portal del SAT o del correo.',
  no_es_cfdi: 'Es un XML, pero no es una factura.',
  cfdi_invalido: 'A la factura le faltan datos o vienen mal. Pide a quien te la dio que la revise.',
  importe_invalido: 'Un importe de la factura no se puede leer. Pide a quien te la dio que la revise.',
  archivo_no_soportado: 'No es un XML ni un ZIP. Comparte el XML de la factura, no el PDF.',
  zip_invalido: 'El ZIP está dañado. Descárgalo otra vez.',
  demasiado_grande: 'Es demasiado grande para ser una factura.',
};

/** Para el resumen: "1 no es versión 4.0" · "2 no son versión 4.0". */
const RESUMEN_RECHAZO: Readonly<Record<MotivoRechazoCfdi, readonly [string, string]>> = {
  version_no_soportada: ['no es versión 4.0', 'no son versión 4.0'],
  sin_timbre: ['no está timbrada', 'no están timbradas'],
  xml_invalido: ['está dañado', 'están dañados'],
  no_es_cfdi: ['no es factura', 'no son facturas'],
  cfdi_invalido: ['trae datos incompletos', 'traen datos incompletos'],
  importe_invalido: ['trae un importe que no se lee', 'traen importes que no se leen'],
  archivo_no_soportado: ['no es XML ni ZIP', 'no son XML ni ZIP'],
  zip_invalido: ['es un ZIP dañado', 'son ZIP dañados'],
  demasiado_grande: ['es demasiado grande', 'son demasiado grandes'],
};

const CODIGOS_PARSER: ReadonlySet<string> = new Set<CodigoErrorCfdi>([
  'xml_invalido',
  'no_es_cfdi',
  'version_no_soportada',
  'sin_timbre',
  'cfdi_invalido',
  'importe_invalido',
]);

const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

function enumerar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** "Importé 8 facturas; 1 no es versión 4.0" · "No importé facturas nuevas; 8 ya las tenías". */
export function resumenImportacion(r: Omit<ResultadoImportacion, 'resumen'>): string {
  const cabeza =
    r.importadas === 0
      ? 'No importé facturas nuevas'
      : `Importé ${miles(r.importadas)} ${r.importadas === 1 ? 'factura' : 'facturas'}`;
  const partes: string[] = [];
  if (r.repetidas > 0)
    partes.push(`${miles(r.repetidas)} ${r.repetidas === 1 ? 'ya la tenías' : 'ya las tenías'}`);
  const porMotivo = new Map<MotivoRechazoCfdi, number>();
  for (const x of r.rechazadas) porMotivo.set(x.motivo, (porMotivo.get(x.motivo) ?? 0) + 1);
  for (const [motivo, n] of porMotivo) {
    const [uno, varios] = RESUMEN_RECHAZO[motivo];
    partes.push(`${miles(n)} ${n === 1 ? uno : varios}`);
  }
  return partes.length === 0 ? cabeza : `${cabeza}; ${enumerar(partes)}`;
}

const esZip = (b: Uint8Array) =>
  b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const terminaEnXml = (nombre: string) => /\.xml$/i.test(nombre);

/** Un XML a leer, con el nombre que se le mostraría a la persona si no entra. */
interface XmlPorLeer {
  readonly archivo: string;
  readonly bytes: Uint8Array;
}

/** Los XML de un ZIP (en cualquier carpeta). Se ignora lo que no es XML: el PDF que acompaña a la factura, etc. */
function xmlDelZip(a: ArchivoCfdi, rechazos: RechazoCfdi[]): XmlPorLeer[] {
  const rechazar = (motivo: MotivoRechazoCfdi, archivo = a.nombre) =>
    rechazos.push({ archivo, motivo, texto: TEXTO_RECHAZO[motivo] });
  if (a.bytes.length > TAMANO_MAXIMO_ZIP) {
    rechazar('demasiado_grande');
    return [];
  }
  let contenido: Record<string, Uint8Array>;
  let total = 0;
  let cuantos = 0;
  const grandes: string[] = [];
  try {
    contenido = unzipSync(a.bytes, {
      filter: (f) => {
        const base = f.name.split('/').pop() ?? '';
        if (f.name.startsWith('__MACOSX/') || base.startsWith('.') || !terminaEnXml(base)) return false;
        cuantos += 1;
        // `originalSize` lo declara el ZIP; fflate no escribe más que eso, así que el tope se respeta.
        if (f.originalSize > TAMANO_MAXIMO_XML || cuantos > ARCHIVOS_MAXIMOS_ZIP) {
          grandes.push(f.name);
          return false;
        }
        total += f.originalSize;
        if (total > TAMANO_MAXIMO_DESCOMPRIMIDO)
          throw new ErrorDominio('zip_invalido', 'zip demasiado grande');
        return true;
      },
    });
  } catch {
    rechazar('zip_invalido');
    return [];
  }
  for (const nombre of grandes) rechazar('demasiado_grande', `${a.nombre} › ${nombre.split('/').pop()}`);
  return Object.keys(contenido)
    .sort()
    .map((nombre) => ({
      archivo: `${a.nombre} › ${nombre.split('/').pop()}`,
      bytes: contenido[nombre] as Uint8Array,
    }));
}

/** Parece texto XML: empieza con `<` (tras BOM y espacios). */
function pareceXml(b: Uint8Array): boolean {
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i += 1;
  return b[i] === 0x3c;
}

function leer(x: XmlPorLeer): { xml: string; leido: CfdiLeido } | MotivoRechazoCfdi {
  if (x.bytes.length > TAMANO_MAXIMO_XML) return 'demasiado_grande';
  const xml = strFromU8(x.bytes);
  try {
    const leido = parsearCfdi(xml);
    if (!UUID.test(leido.uuid)) return 'cfdi_invalido';
    return { xml, leido };
  } catch (error) {
    if (error instanceof ErrorDominio && CODIGOS_PARSER.has(error.codigo))
      return error.codigo as CodigoErrorCfdi;
    // Cualquier otra falla del lector: el archivo no se importa y no se dice nada de su contenido (regla 9).
    return 'xml_invalido';
  }
}

/**
 * Importa los archivos (XML o ZIP) en una sola transacción. Una factura con un UUID que ya está guardado (o que
 * viene dos veces) cuenta como repetida y no cambia nada; las que no se leen se rechazan con su motivo.
 */
export function importarCfdi(ctx: Contexto, archivos: readonly ArchivoCfdi[]): ResultadoImportacion {
  exigirConsentimiento(ctx);
  const rechazadas: RechazoCfdi[] = [];
  const porLeer: XmlPorLeer[] = [];
  for (const a of archivos) {
    if (esZip(a.bytes)) porLeer.push(...xmlDelZip(a, rechazadas));
    else if (terminaEnXml(a.nombre) || pareceXml(a.bytes))
      porLeer.push({ archivo: a.nombre, bytes: a.bytes });
    else
      rechazadas.push({
        archivo: a.nombre,
        motivo: 'archivo_no_soportado',
        texto: TEXTO_RECHAZO.archivo_no_soportado,
      });
  }
  const leidos: { xml: string; leido: CfdiLeido }[] = [];
  for (const x of porLeer) {
    const r = leer(x);
    if (typeof r === 'string') rechazadas.push({ archivo: x.archivo, motivo: r, texto: TEXTO_RECHAZO[r] });
    else leidos.push(r);
  }
  let importadas = 0;
  let repetidas = 0;
  enTransaccion(ctx, () => {
    const uuids = [...new Set(leidos.map((l) => l.leido.uuid))];
    const vistos = new Set(
      uuids.length === 0
        ? []
        : ctx.db
            .select({ uuid: cfdi.uuid })
            .from(cfdi)
            .where(inArray(cfdi.uuid, uuids))
            .all()
            .map((f) => f.uuid),
    );
    for (const { xml, leido: c } of leidos) {
      if (vistos.has(c.uuid)) {
        repetidas += 1;
        continue;
      }
      vistos.add(c.uuid);
      ctx.db
        .insert(cfdi)
        .values({
          uuid: c.uuid,
          xml,
          emisorRfc: c.emisor_rfc,
          receptorRfc: c.receptor_rfc,
          fecha: c.fecha,
          tipoComprobante: c.tipo_comprobante,
          usoCfdi: c.uso_cfdi,
          formaPago: c.forma_pago,
          metodoPago: c.metodo_pago,
          total: c.total,
          iva: c.iva_trasladado,
          importadoEn: ctx.reloj.ahora(),
        })
        .run();
      importadas += 1;
    }
  });
  const sinResumen = { importadas, repetidas, rechazadas };
  return { ...sinResumen, resumen: resumenImportacion(sinResumen) };
}

/** Etiquetas del usuario por factura (`05 §E13.2`). */
export const EtiquetasGuardadas = z.strictObject({
  /** La factura no se muestra ni cuenta; el XML sigue guardado y se puede recuperar. */
  oculta: z.boolean().optional(),
  lentes: z.boolean().optional(),
  beneficiario: z.string().trim().min(1).max(60).optional(),
  alumno: z.string().trim().min(1).max(60).optional(),
  nivel: z.string().min(1).max(40).optional(),
  pagado: z.boolean().optional(),
  forma_pago: z
    .string()
    .regex(/^\d{2}$/)
    .optional(),
});

/** Etiquetas locales además de las que usa E13.2 (`oculta` no va al motor). */
export type EtiquetasCfdiLocal = EtiquetaCfdi & { readonly oculta?: boolean };

/** Una factura guardada: lo que leyó E13.1 (del XML guardado) y lo que dijo el usuario. */
export interface CfdiGuardado {
  readonly leido: CfdiLeido;
  readonly etiquetas: EtiquetasCfdiLocal;
  readonly estatus: 'vigente' | 'cancelado' | 'desconocido';
}

function etiquetasDe(json: string): EtiquetasCfdiLocal {
  const r = EtiquetasGuardadas.safeParse(JSON.parse(json));
  if (!r.success) throw new ErrorDominio('etiquetas_invalidas', 'las etiquetas de la factura no son válidas');
  const e: EtiquetasCfdiLocal = {};
  for (const [k, v] of Object.entries(r.data)) if (v !== undefined) Object.assign(e, { [k]: v });
  return e;
}

/**
 * Facturas guardadas, en orden de fecha y UUID. Se vuelven a leer del XML guardado (la fuente) para tener lo que
 * E13.2 necesita y la tabla no repite (moneda, nombre del emisor).
 */
export function listarCfdiGuardados(ctx: Contexto): CfdiGuardado[] {
  return ctx.db
    .select({ xml: cfdi.xml, etiquetas: cfdi.etiquetas, estatus: cfdi.estatus })
    .from(cfdi)
    .orderBy(asc(cfdi.fecha), asc(cfdi.uuid))
    .all()
    .map((f) => ({
      leido: parsearCfdi(f.xml),
      etiquetas: etiquetasDe(f.etiquetas),
      estatus: f.estatus as CfdiGuardado['estatus'],
    }));
}

/** Cambia las etiquetas de una factura (`cambios` con `undefined` quita esa etiqueta). */
export function etiquetarCfdi(
  ctx: Contexto,
  uuid: string,
  cambios: { readonly [K in keyof EtiquetasCfdiLocal]?: EtiquetasCfdiLocal[K] | undefined },
): EtiquetasCfdiLocal {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const fila = ctx.db.select({ etiquetas: cfdi.etiquetas }).from(cfdi).where(eq(cfdi.uuid, uuid)).get();
    if (!fila) throw new ErrorDominio('cfdi_inexistente', 'la factura no existe');
    const nuevas = Object.fromEntries(
      Object.entries({ ...etiquetasDe(fila.etiquetas), ...cambios }).filter(([, v]) => v !== undefined),
    );
    const r = EtiquetasGuardadas.safeParse(nuevas);
    if (!r.success)
      throw new ErrorDominio('etiquetas_invalidas', 'las etiquetas de la factura no son válidas');
    ctx.db
      .update(cfdi)
      .set({ etiquetas: JSON.stringify(r.data) })
      .where(eq(cfdi.uuid, uuid))
      .run();
    return etiquetasDe(JSON.stringify(r.data));
  });
}

/** Cuántas facturas hay guardadas (para decir "Importa tus facturas" o no). */
export function contarCfdi(ctx: Contexto): number {
  return ctx.db.select({ n: count() }).from(cfdi).get()?.n ?? 0;
}

/** Estatus que dio el usuario (`05 §E13.2`): vigente, cancelada en el SAT o desconocido. */
export function actualizarEstatusCfdi(ctx: Contexto, uuid: string, estatus: CfdiGuardado['estatus']): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const cambios = ctx.db.update(cfdi).set({ estatus }).where(eq(cfdi.uuid, uuid)).run();
    if ((cambios as { changes: number }).changes === 0)
      throw new ErrorDominio('cfdi_inexistente', 'la factura no existe');
  });
}
