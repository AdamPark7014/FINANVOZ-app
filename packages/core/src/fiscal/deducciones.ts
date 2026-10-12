import { type Centavos, type PuntosBase, exigirCentavos } from '../dinero';
import { ErrorDominio } from '../errores';
import { type PlainDate, esFecha, partes } from '../fecha';

/** Salida de E13.1 `parsearCfdi` (`packages/fiscal`): solo lo que E13 necesita de un CFDI 4.0. */
export interface CfdiLeido {
  /** UUID del timbre, en mayúsculas. */
  uuid: string;
  /** Los 10 primeros caracteres de `Fecha`. */
  fecha: PlainDate;
  tipo_comprobante: string;
  forma_pago: string | null;
  metodo_pago: string | null;
  moneda: string | null;
  subtotal: Centavos;
  total: Centavos;
  /** Σ `Traslado` con `Impuesto="002"` del nodo `Impuestos` del comprobante. */
  iva_trasladado: Centavos;
  emisor_rfc: string;
  emisor_nombre: string | null;
  receptor_rfc: string;
  uso_cfdi: string | null;
}

/** Un CFDI con el estatus que dio el usuario (no se consulta al SAT). */
export type CfdiParaDeducir = CfdiLeido & { estatus?: 'vigente' | 'cancelado' };

/** Etiquetas del usuario por UUID (pantalla de Deducciones). */
export interface EtiquetaCfdi {
  lentes?: boolean;
  beneficiario?: string;
  alumno?: string;
  nivel?: string;
  /** El usuario confirmó el pago de un PPD. */
  pagado?: boolean;
  /** Forma de pago real de un PPD confirmado (el CFDI trae 99, "por definir"). */
  forma_pago?: string;
}

/** Tope de un uso o tope global: se toma el menor de los que vengan. */
export interface TopeDeduccion {
  umas?: number;
  porcentaje_ingresos_bp?: PuntosBase;
  fijo?: Centavos;
}

export interface ReglaUso {
  en_tope_global: boolean;
  requiere_pago_electronico: boolean;
  tope?: TopeDeduccion;
  /** Colegiaturas: tope por alumno según el nivel; exige las etiquetas `alumno` y `nivel`. */
  tope_por_alumno_nivel?: Record<string, Centavos>;
}

/** Parámetros de E13.2 (sección `deducciones` de `config/fiscal/<año>.json` + `uma.anual`). */
export interface ConfigDeducciones {
  uma_anual: Centavos;
  tope_global: TopeDeduccion;
  formas_pago_electronicas: readonly string[];
  tope_lentes_por_beneficiario: Centavos;
  usos: Record<string, ReglaUso>;
}

export type MotivoExclusion =
  | 'no_es_ingreso'
  | 'otro_receptor'
  | 'otro_ejercicio'
  | 'cancelado'
  | 'moneda_extranjera'
  | 'no_deducible'
  | 'ppd_sin_pago'
  | 'pago_en_efectivo'
  | 'forma_de_pago_no_valida'
  | 'falta_alumno_nivel';

export interface DeduccionPorUso {
  cfdis: number;
  bruto: Centavos;
  deducible: Centavos;
  en_tope_global: boolean;
}

export interface ResultadoDeducciones {
  por_uso: Record<string, DeduccionPorUso>;
  excluidos: { uuid: string; motivo: MotivoExclusion }[];
  sujeto_a_tope_global: Centavos;
  tope_global: Centavos;
  excedente_perdido: Centavos;
  total_deducible: Centavos;
}

const FORMA_EFECTIVO = '01';
const BENEFICIARIO_TITULAR = 'titular';

function porcentajeDe(monto: Centavos, bp: PuntosBase): Centavos {
  return Number((BigInt(monto) * BigInt(bp)) / 10000n);
}

/** El menor de los topes de la regla; `null` si no trae ninguno. */
function topePorRegla(
  regla: TopeDeduccion | undefined,
  ingresos: Centavos,
  umaAnual: Centavos,
): Centavos | null {
  if (!regla) return null;
  const topes: Centavos[] = [];
  if (regla.umas !== undefined) topes.push(regla.umas * umaAnual);
  if (regla.porcentaje_ingresos_bp !== undefined)
    topes.push(porcentajeDe(ingresos, regla.porcentaje_ingresos_bp));
  if (regla.fijo !== undefined) topes.push(regla.fijo);
  return topes.length > 0 ? Math.min(...topes) : null;
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const normalizarRfc = (rfc: string) => rfc.trim().toUpperCase();

function motivoDeExclusion(
  c: CfdiParaDeducir,
  et: EtiquetaCfdi,
  ejercicio: number,
  rfc: string,
  config: ConfigDeducciones,
): MotivoExclusion | null {
  const regla = c.uso_cfdi === null ? undefined : config.usos[c.uso_cfdi];
  const ppdPagado = c.metodo_pago === 'PPD' && et.pagado === true;
  // Un PPD trae FormaPago 99; al confirmar el pago, el usuario da la forma real (E13-12).
  const forma = ppdPagado ? (et.forma_pago ?? null) : c.forma_pago;
  if (c.tipo_comprobante !== 'I') return 'no_es_ingreso';
  if (normalizarRfc(c.receptor_rfc) !== rfc) return 'otro_receptor';
  if (partes(c.fecha).anio !== ejercicio) return 'otro_ejercicio';
  if (c.estatus === 'cancelado') return 'cancelado';
  if (c.moneda !== null && c.moneda !== 'MXN') return 'moneda_extranjera';
  if (!regla) return 'no_deducible';
  if (c.metodo_pago === 'PPD' && !ppdPagado) return 'ppd_sin_pago';
  if (
    regla.requiere_pago_electronico &&
    (forma === null || !config.formas_pago_electronicas.includes(forma))
  ) {
    return forma === FORMA_EFECTIVO ? 'pago_en_efectivo' : 'forma_de_pago_no_valida';
  }
  if (regla.tope_por_alumno_nivel) {
    const { alumno, nivel } = et;
    if (!alumno || nivel === undefined || !Object.hasOwn(regla.tope_por_alumno_nivel, nivel)) {
      return 'falta_alumno_nivel';
    }
  }
  return null;
}

/**
 * E13.2 · Estimación de deducciones personales del ejercicio (`05 §E13.2`).
 * `ingresos`: ingresos brutos del ejercicio que da el usuario (incluidos los exentos).
 * Es una estimación para preparar la declaración con un contador; no es asesoría fiscal.
 */
export function estimarDeducciones(
  cfdis: readonly CfdiParaDeducir[],
  ingresos: Centavos,
  ejercicio: number,
  rfc: string,
  config: ConfigDeducciones,
  etiquetas: Readonly<Record<string, EtiquetaCfdi>> = {},
): ResultadoDeducciones {
  exigirCentavos(ingresos, 'ingresos');
  if (!Number.isSafeInteger(ejercicio))
    throw new ErrorDominio('ejercicio_invalido', 'ejercicio debe ser un año entero');
  const tope_global = topePorRegla(config.tope_global, ingresos, config.uma_anual);
  if (tope_global === null)
    throw new ErrorDominio('config_fiscal_invalida', 'tope_global sin umas, porcentaje ni fijo');
  for (const c of cfdis) {
    if (!esFecha(c.fecha)) throw new ErrorDominio('fecha_invalida', 'fecha del CFDI no es YYYY-MM-DD');
    exigirCentavos(c.total, 'total');
  }
  const etiquetaDe = (uuid: string): EtiquetaCfdi =>
    (Object.hasOwn(etiquetas, uuid) ? etiquetas[uuid] : undefined) ?? {};
  const rfcUsuario = normalizarRfc(rfc);

  const ordenados = [...cfdis].sort((a, b) => comparar(a.fecha, b.fecha) || comparar(a.uuid, b.uuid));
  const incluidos: CfdiParaDeducir[] = [];
  const excluidos: ResultadoDeducciones['excluidos'] = [];
  for (const c of ordenados) {
    const motivo = motivoDeExclusion(c, etiquetaDe(c.uuid), ejercicio, rfcUsuario, config);
    if (motivo) excluidos.push({ uuid: c.uuid, motivo });
    else incluidos.push(c);
  }

  // Monto aceptado por CFDI: el total (con IVA); lentes con tope por beneficiario en el año, en orden de fecha.
  const aceptado = new Map<CfdiParaDeducir, Centavos>();
  const usadoLentes = new Map<string, Centavos>();
  for (const c of incluidos) {
    const et = etiquetaDe(c.uuid);
    let monto = c.total;
    if (et.lentes === true) {
      const beneficiario = et.beneficiario ?? BENEFICIARIO_TITULAR;
      const usado = usadoLentes.get(beneficiario) ?? 0;
      monto = Math.min(monto, Math.max(0, config.tope_lentes_por_beneficiario - usado));
      usadoLentes.set(beneficiario, usado + monto);
    }
    aceptado.set(c, monto);
  }

  const por_uso: Record<string, DeduccionPorUso> = {};
  for (const uso of Object.keys(config.usos).sort(comparar)) {
    const regla = config.usos[uso] as ReglaUso;
    const cs = incluidos.filter((c) => c.uso_cfdi === uso);
    if (cs.length === 0) continue;
    const bruto = cs.reduce((s, c) => s + c.total, 0);
    let deducible: Centavos;
    if (regla.tope_por_alumno_nivel) {
      const topes = regla.tope_por_alumno_nivel;
      // Por alumno: si cursó más de un nivel en el año, el tope mayor de esos niveles.
      const porAlumno = new Map<string, { monto: Centavos; tope: Centavos }>();
      for (const c of cs) {
        const { alumno = '', nivel = '' } = etiquetaDe(c.uuid);
        const al = porAlumno.get(alumno) ?? { monto: 0, tope: 0 };
        al.monto += aceptado.get(c) ?? 0;
        al.tope = Math.max(al.tope, topes[nivel] ?? 0);
        porAlumno.set(alumno, al);
      }
      deducible = [...porAlumno.values()].reduce((s, al) => s + Math.min(al.monto, al.tope), 0);
    } else {
      const suma = cs.reduce((s, c) => s + (aceptado.get(c) ?? 0), 0);
      const tope = topePorRegla(regla.tope, ingresos, config.uma_anual);
      deducible = tope === null ? suma : Math.min(suma, tope);
    }
    por_uso[uso] = { cfdis: cs.length, bruto, deducible, en_tope_global: regla.en_tope_global };
  }

  const usos = Object.values(por_uso);
  const sujeto = usos.filter((u) => u.en_tope_global).reduce((s, u) => s + u.deducible, 0);
  const fuera = usos.filter((u) => !u.en_tope_global).reduce((s, u) => s + u.deducible, 0);
  return {
    por_uso,
    excluidos,
    sujeto_a_tope_global: sujeto,
    tope_global,
    excedente_perdido: Math.max(0, sujeto - tope_global),
    total_deducible: Math.min(sujeto, tope_global) + fuera,
  };
}
