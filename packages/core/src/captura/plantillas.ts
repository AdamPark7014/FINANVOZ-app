/**
 * Motor de plantillas de notificaciones (`docs/07-CAPTURA.md §3`).
 *
 * Regla 9: ningún error ni resultado lleva el texto de la notificación fuera de los campos extraídos;
 * los mensajes de error solo nombran ids de plantilla o de banco.
 */
import type { Centavos } from '../dinero';
import { ErrorDominio } from '../errores';

export const TIPOS_PLANTILLA = [
  'cargo',
  'retiro',
  'transferencia_enviada',
  'transferencia_recibida',
  'pago_recibido_tarjeta',
  'devolucion',
  'cobro_recibido',
  'ignorar',
] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

export const CAMPOS_PLANTILLA = ['texto', 'titulo', 'titulo+texto'] as const;
/** `titulo+texto` = `${titulo} | ${texto}`. */
export type CampoPlantilla = (typeof CAMPOS_PLANTILLA)[number];

/** Una plantilla tal como viene en el archivo (`fixtures/notificaciones/plantillas.ejemplo.json`). */
export interface Plantilla {
  /** `banco.evento.vN` */
  readonly id: string;
  readonly banco: string;
  readonly tipo: TipoPlantilla;
  readonly campo: CampoPlantilla;
  /** RegExp de JS con grupos nombrados: monto, comercio, ultimos4, contraparte, destino4. */
  readonly patron: string;
  /** Por omisión `'iu'`. */
  readonly flags?: string | undefined;
}

export interface BancoPlantillas {
  readonly id: string;
  readonly nombre?: string | undefined;
  readonly paquetesAndroid: readonly string[];
}

export interface PlantillaCompilada extends Plantilla {
  readonly expresion: RegExp;
}

export interface CatalogoPlantillas {
  readonly version: number | null;
  readonly bancos: readonly BancoPlantillas[];
  /** En el orden del archivo: dentro de cada banco, la primera que coincide gana. */
  readonly plantillas: readonly PlantillaCompilada[];
}

export interface NotificacionEntrante {
  readonly paquete: string;
  readonly titulo: string | null | undefined;
  readonly texto: string | null | undefined;
}

export interface Interpretacion {
  /** `null` si el paquete no pertenece a ningún banco del catálogo. */
  readonly banco: string | null;
  /** `null` sin plantilla (`no_reconocida`). */
  readonly plantilla: string | null;
  readonly tipo: TipoPlantilla | 'no_reconocida';
  readonly monto?: Centavos;
  readonly comercio?: string;
  readonly ultimos4?: string;
  readonly contraparte?: string;
  readonly destino4?: string;
}

const FLAGS_POR_OMISION = 'iu';
const CAMPOS_TEXTO = ['comercio', 'ultimos4', 'contraparte', 'destino4'] as const;

function invalido(mensaje: string): ErrorDominio {
  return new ErrorDominio('plantillas_invalidas', mensaje);
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function textoNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v !== '';
}

/**
 * Valida un archivo de plantillas (`{version?, bancos, plantillas}`; `advertencia` se ignora) y compila sus
 * expresiones. Cualquier error invalida el archivo completo (`plantillas_invalidas`).
 */
export function compilarPlantillas(archivo: unknown): CatalogoPlantillas {
  if (!esObjeto(archivo)) throw invalido('el archivo de plantillas no es un objeto');
  const { version, bancos: bancosCrudos, plantillas: plantillasCrudas } = archivo;
  if (version !== undefined && !Number.isSafeInteger(version)) throw invalido('version no es entera');
  if (!Array.isArray(bancosCrudos) || !Array.isArray(plantillasCrudas)) {
    throw invalido('faltan las listas bancos o plantillas');
  }

  const bancos: BancoPlantillas[] = [];
  const idsBanco = new Set<string>();
  const paquetes = new Set<string>();
  for (const b of bancosCrudos as unknown[]) {
    if (!esObjeto(b) || !textoNoVacio(b['id'])) throw invalido('banco sin id');
    const id = b['id'];
    const lista = b['paquetes_android'];
    if (!Array.isArray(lista) || !lista.every(textoNoVacio)) throw invalido(`banco ${id}: paquetes_android`);
    if (idsBanco.has(id)) throw invalido(`banco ${id} repetido`);
    idsBanco.add(id);
    for (const p of lista) {
      if (paquetes.has(p)) throw invalido(`banco ${id}: paquete repetido en otro banco`);
      paquetes.add(p);
    }
    const nombre = b['nombre'];
    bancos.push({ id, ...(typeof nombre === 'string' ? { nombre } : {}), paquetesAndroid: [...lista] });
  }

  const plantillas: PlantillaCompilada[] = [];
  const idsPlantilla = new Set<string>();
  for (const p of plantillasCrudas as unknown[]) {
    if (!esObjeto(p) || !textoNoVacio(p['id'])) throw invalido('plantilla sin id');
    const id = p['id'];
    const { banco, tipo, campo, patron, flags } = p;
    if (idsPlantilla.has(id)) throw invalido(`plantilla ${id} repetida`);
    idsPlantilla.add(id);
    if (!textoNoVacio(banco) || !idsBanco.has(banco)) throw invalido(`plantilla ${id}: banco desconocido`);
    if (!TIPOS_PLANTILLA.includes(tipo as TipoPlantilla)) throw invalido(`plantilla ${id}: tipo desconocido`);
    if (!CAMPOS_PLANTILLA.includes(campo as CampoPlantilla)) {
      throw invalido(`plantilla ${id}: campo desconocido`);
    }
    if (!textoNoVacio(patron)) throw invalido(`plantilla ${id}: patron vacío`);
    if (flags !== undefined && typeof flags !== 'string') throw invalido(`plantilla ${id}: flags`);
    const banderas = flags ?? FLAGS_POR_OMISION;
    // `g` y `y` hacen que `exec` dependa de `lastIndex`: el resultado dejaría de ser determinista.
    if (/[gy]/.test(banderas)) throw invalido(`plantilla ${id}: flags g/y no permitidas`);
    let expresion: RegExp;
    try {
      expresion = new RegExp(patron, banderas);
    } catch {
      throw invalido(`plantilla ${id}: el patrón no compila`);
    }
    plantillas.push({
      id,
      banco,
      tipo: tipo as TipoPlantilla,
      campo: campo as CampoPlantilla,
      patron,
      ...(flags === undefined ? {} : { flags }),
      expresion,
    });
  }

  return { version: typeof version === 'number' ? version : null, bancos, plantillas };
}

/**
 * `parsearMonto(s)`: quita `$`, espacios y `MXN`; quita comas; parte en `.`;
 * `entero·100 + decimales` rellenados a 2 dígitos. Aritmética entera.
 */
export function parsearMonto(s: string): Centavos {
  const limpio = s.replace(/MXN/gi, '').replace(/[$\s,]/g, '');
  const m = /^([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(limpio);
  if (!m?.[1])
    throw new ErrorDominio('monto_invalido', 'el monto de la notificación no tiene un formato válido');
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(centavos)) {
    throw new ErrorDominio('monto_invalido', 'el monto de la notificación excede el rango');
  }
  return centavos;
}

/** Banco del catálogo al que pertenece un paquete de Android (`null` si ninguno). */
export function bancoDePaquete(paquete: string, catalogo: CatalogoPlantillas): string | null {
  return catalogo.bancos.find((b) => b.paquetesAndroid.includes(paquete))?.id ?? null;
}

function campoAProbar(campo: CampoPlantilla, titulo: string, texto: string): string {
  if (campo === 'titulo') return titulo;
  if (campo === 'texto') return texto;
  return `${titulo} | ${texto}`;
}

/**
 * Algoritmo de `07 §3`: paquete → banco; plantillas del banco en orden; la primera que coincide gana;
 * sin coincidencia → `no_reconocida`. Si la plantilla que coincide no da un monto válido (o falta el grupo
 * `monto` en un tipo que no es `ignorar`), la notificación queda `no_reconocida` para registrarla a mano.
 */
export function interpretarNotificacion(
  notificacion: NotificacionEntrante,
  catalogo: CatalogoPlantillas,
): Interpretacion {
  const banco = bancoDePaquete(notificacion.paquete, catalogo);
  const noReconocida: Interpretacion = { banco, plantilla: null, tipo: 'no_reconocida' };
  if (banco === null) return noReconocida;
  const titulo = notificacion.titulo ?? '';
  const texto = notificacion.texto ?? '';

  for (const p of catalogo.plantillas) {
    if (p.banco !== banco) continue;
    const m = p.expresion.exec(campoAProbar(p.campo, titulo, texto));
    if (!m) continue;
    const grupos = m.groups ?? {};
    if (p.tipo === 'ignorar') return { banco, plantilla: p.id, tipo: 'ignorar' };

    const montoCrudo = grupos['monto'];
    if (montoCrudo === undefined) return noReconocida;
    let monto: Centavos;
    try {
      monto = parsearMonto(montoCrudo);
    } catch {
      return noReconocida;
    }
    const extra: { -readonly [K in (typeof CAMPOS_TEXTO)[number]]?: string } = {};
    for (const k of CAMPOS_TEXTO) {
      const v = grupos[k]?.trim();
      if (v) extra[k] = v;
    }
    return { banco, plantilla: p.id, tipo: p.tipo, monto, ...extra };
  }
  return noReconocida;
}
