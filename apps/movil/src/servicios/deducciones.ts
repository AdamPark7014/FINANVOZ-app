import { z } from 'zod';
import {
  ahorroPorDeducciones,
  ErrorDominio,
  estimarDeducciones,
  partes,
  type Centavos,
  type CfdiParaDeducir,
  type ConfigFiscal,
  type MotivoExclusion,
  type PlainDate,
} from '@cartera/core';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId } from './catalogo';
import {
  actualizarEstatusCfdi,
  etiquetarCfdi,
  listarCfdiGuardados,
  type CfdiGuardado,
} from './cfdi';
import { listarPersonas } from './personas';
import { cargarConfigFiscal } from './config-fiscal';
import type { Contexto } from './contexto';
import type { EntradaMovimiento } from './formulario';
import { etiquetaDiaMes, pesos } from './formato';
import { escribirAjuste, leerAjuste } from './preferencias';

/**
 * Deducciones personales (M12, RF-FIS-02, `02 §24`, `05 §E13.2–E13.3`): el perfil fiscal que da el usuario
 * (`ajuste.perfil_fiscal`, solo en el teléfono), la estimación del año con E13.2 sobre las facturas importadas y
 * sus etiquetas, el ISR que podría ahorrarse (E13.3) y las acciones de la pantalla: alumno y nivel de una
 * colegiatura, lentes, "Ya la pagué" de una factura en parcialidades. Las cifras salen de `@cartera/core`; aquí
 * solo se arman las frases. Nada de esto va a logs (regla 9).
 */

const RFC_PERSONA_FISICA = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/;

const PerfilGuardado = z.strictObject({
  rfc: z.string().regex(RFC_PERSONA_FISICA),
  ingresos: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  base_gravable: z.int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
});

/** `ajuste.perfil_fiscal` (`04 §3`): RFC, ingresos brutos del año (incluidos los exentos) y base gravable. */
export type PerfilFiscal = z.infer<typeof PerfilGuardado>;

const CLAVE_PERFIL = 'perfil_fiscal';

/** RFC sin espacios ni guiones y en mayúsculas; `null` si no es el de una persona física (13 caracteres). */
export function normalizarRfc(texto: string): string | null {
  const rfc = texto.replace(/[\s-]/g, '').toUpperCase();
  return RFC_PERSONA_FISICA.test(rfc) ? rfc : null;
}

export function obtenerPerfilFiscal(ctx: Contexto): PerfilFiscal | null {
  return leerAjuste(ctx, CLAVE_PERFIL, PerfilGuardado);
}

/** Guarda el perfil fiscal (primera vez o al editarlo). Lanza `rfc_invalido` o `monto_invalido`. */
export function guardarPerfilFiscal(
  ctx: Contexto,
  entrada: { rfc: string; ingresos: Centavos; baseGravable: Centavos | null },
): PerfilFiscal {
  exigirConsentimiento(ctx);
  const rfc = normalizarRfc(entrada.rfc);
  if (!rfc) throw new ErrorDominio('rfc_invalido', 'el RFC no es de persona física');
  const montoValido = (m: number) => Number.isSafeInteger(m) && m >= 0;
  if (!montoValido(entrada.ingresos) || (entrada.baseGravable !== null && !montoValido(entrada.baseGravable)))
    throw new ErrorDominio('monto_invalido', 'monto inválido');
  const perfil: PerfilFiscal = { rfc, ingresos: entrada.ingresos, base_gravable: entrada.baseGravable };
  escribirAjuste(ctx, CLAVE_PERFIL, PerfilGuardado, perfil);
  return perfil;
}

/** Motivo de exclusión en lenguaje llano (`02 §24`, pendiente 95). */
export const TEXTO_MOTIVO_EXCLUSION: Readonly<Record<MotivoExclusion, string>> = {
  no_es_ingreso: 'no es una factura de compra (es de un pago, una devolución o un traslado)',
  otro_receptor: 'está a nombre de otro RFC',
  otro_ejercicio: 'es de otro año',
  cancelado: 'la marcaste como cancelada',
  moneda_extranjera: 'está en otra moneda',
  no_deducible: 'no es un gasto deducible',
  ppd_sin_pago: 'factura en pagos sin confirmar',
  pago_en_efectivo: 'lo pagaste en efectivo',
  forma_de_pago_no_valida:
    'la forma de pago no permite deducirla: paga con tarjeta, transferencia o cheque a tu nombre',
  falta_alumno_nivel: 'falta decir el alumno y el nivel',
};

/**
 * Nombre de cada uso de CFDI de deducciones personales (catálogo `c_UsoCFDI` del SAT) para "por tipo". Son
 * etiquetas, no parámetros: qué uso deduce y con qué tope lo dice `config/fiscal/<año>.json`.
 */
const NOMBRE_USO: Readonly<Record<string, string>> = {
  D01: 'Médicos, dentista y hospital',
  D02: 'Gastos por incapacidad o discapacidad',
  D03: 'Gastos funerarios',
  D04: 'Donativos',
  D05: 'Intereses de tu crédito hipotecario',
  D06: 'Aportaciones voluntarias para tu retiro',
  D07: 'Seguros de gastos médicos',
  D08: 'Transporte escolar',
  D09: 'Cuentas de ahorro para el retiro',
  D10: 'Colegiaturas',
};

/** Uso de las facturas en las que se ofrece "Son lentes ópticos" (los lentes se facturan como gasto médico). */
const USO_LENTES = 'D01';

/** Clave de beneficiario de lentes para el titular (`05 §E13.2`, oráculo). */
export const BENEFICIARIO_TITULAR = 'titular';

const claveBeneficiarioPersona = (cuentaId: string) => `p:${cuentaId}`;

/** "Yo" y cada persona registrada, para el tope de lentes por beneficiario. */
export function opcionesBeneficiarioLentes(ctx: Contexto): readonly { readonly valor: string; readonly etiqueta: string }[] {
  return [
    { valor: BENEFICIARIO_TITULAR, etiqueta: 'Yo' },
    ...listarPersonas(ctx).map((p) => ({
      valor: claveBeneficiarioPersona(p.cuentaId),
      etiqueta: p.nombre,
    })),
  ];
}

function etiquetaBeneficiario(
  clave: string | null | undefined,
  opciones: readonly { readonly valor: string; readonly etiqueta: string }[],
): string | null {
  if (clave === null || clave === undefined) return null;
  return opciones.find((o) => o.valor === clave)?.etiqueta ?? null;
}

const NOMBRE_NIVEL: Readonly<Record<string, string>> = {
  preescolar: 'Preescolar',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  profesional_tecnico: 'Profesional técnico',
  bachillerato: 'Bachillerato',
};

/** "Ya la pagué": cómo se pagó (`02 §24`) y el código de forma de pago del SAT que se revisa (E13-12). */
export const FORMAS_PAGO_CONFIRMADO = [
  { valor: 'transferencia', etiqueta: 'Transferencia', codigo: '03' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta', codigo: '04' },
  { valor: 'efectivo', etiqueta: 'Efectivo', codigo: '01' },
  { valor: 'cheque', etiqueta: 'Cheque', codigo: '02' },
] as const;
export type FormaPagoConfirmado = (typeof FORMAS_PAGO_CONFIRMADO)[number]['valor'];

/** Texto fijo de `08 §1` para impuestos y deducciones (checklist `08 §7.2`), sin cambiar una palabra. */
export const LEYENDA_ESTIMACION =
  'Estimación para apartar dinero y preparar tu declaración. No sustituye a tu contador ni presenta declaraciones ante el SAT.';

export const MENSAJE_SIN_PARAMETROS =
  'Todavía no puedo estimar tus deducciones de este año: un contador está validando topes y reglas. En cuanto termine, aquí verás cuánto llevas. Tus facturas ya quedan guardadas.';

export interface FacturaVista {
  readonly uuid: string;
  /** Nombre de quien la emitió (o "Factura del 14 mar" si no lo trae). */
  readonly emisor: string;
  readonly fecha: PlainDate;
  readonly textoFecha: string;
  readonly total: Centavos;
  readonly textoTotal: string;
  /** "Colegiaturas", "Médicos, dentista y hospital"… o `null` si el uso no es de deducciones personales. */
  readonly tipo: string | null;
  /** `sin_calcular` mientras no haya parámetros validados o perfil. */
  readonly estado: 'deducible' | 'no_deducible' | 'sin_calcular';
  readonly motivo: MotivoExclusion | null;
  readonly textoMotivo: string | null;
  /** Colegiatura: pide alumno y nivel (los niveles son los de la configuración). */
  readonly pideAlumnoNivel: boolean;
  readonly alumno: string | null;
  readonly nivel: string | null;
  readonly ofreceLentes: boolean;
  readonly lentes: boolean;
  readonly beneficiarioLentes: string | null;
  readonly textoBeneficiarioLentes: string | null;
  /** El usuario la marcó cancelada (E13.2). */
  readonly marcadaCancelada: boolean;
  /** Factura en parcialidades (PPD): "Ya la pagué". */
  readonly enPagos: boolean;
  readonly pagoConfirmado: FormaPagoConfirmado | null;
}

export interface TipoDeduccionVista {
  readonly uso: string;
  readonly nombre: string;
  readonly facturas: number;
  readonly deducible: Centavos;
  readonly texto: string;
}

interface Comunes {
  readonly ejercicio: number;
  /** Años con facturas (y el actual), del más reciente al más antiguo. */
  readonly ejercicios: readonly number[];
  readonly facturas: readonly FacturaVista[];
  /** Importadas por error: no se muestran ni cuentan, pero se pueden recuperar. */
  readonly ocultas: readonly FacturaVista[];
  readonly beneficiariosLentes: readonly { readonly valor: string; readonly etiqueta: string }[];
}

export type VistaDeducciones =
  | (Comunes & { readonly estado: 'sin_perfil' })
  | (Comunes & { readonly estado: 'sin_parametros'; readonly perfil: PerfilFiscal; readonly mensaje: string })
  | (Comunes & {
      readonly estado: 'listo';
      readonly perfil: PerfilFiscal;
      readonly total: Centavos;
      /** "Llevas $25,900 deducibles en 2026 (estimación)" (`02 §24`). */
      readonly titulo: string;
      readonly porTipo: readonly TipoDeduccionVista[];
      readonly noDeducibles: readonly FacturaVista[];
      /** Lo que pasó del tope global y ya no cuenta (E13-11); `null` si no se llegó al tope. */
      readonly textoTope: string | null;
      /** "Podrías pagar unos $2,817 menos de ISR" (E13.3) o qué falta para estimarlo. */
      readonly textoAhorro: string;
      readonly ahorro: Centavos | null;
      readonly niveles: readonly { readonly valor: string; readonly etiqueta: string }[];
      readonly leyenda: string;
    });

const formaConfirmada = (codigo: string | undefined): FormaPagoConfirmado | null =>
  FORMAS_PAGO_CONFIRMADO.find((f) => f.codigo === codigo)?.valor ?? null;

/** Regla de colegiaturas de la configuración (la que trae `tope_por_alumno_nivel`). */
function usosConAlumno(config: ConfigFiscal | null): ReadonlySet<string> {
  if (!config) return new Set();
  return new Set(
    Object.entries(config.deducciones.usos)
      .filter(([, r]) => r.tope_por_alumno_nivel !== undefined)
      .map(([uso]) => uso),
  );
}

function factura(
  g: CfdiGuardado,
  config: ConfigFiscal | null,
  motivo: MotivoExclusion | null | undefined,
  beneficiarios: readonly { readonly valor: string; readonly etiqueta: string }[],
): FacturaVista {
  const c = g.leido;
  const conAlumno = usosConAlumno(config);
  const uso = c.uso_cfdi;
  const enConfig = uso !== null && config !== null && Object.hasOwn(config.deducciones.usos, uso);
  return {
    uuid: c.uuid,
    emisor: c.emisor_nombre ?? `Factura del ${etiquetaDiaMes(c.fecha)}`,
    fecha: c.fecha,
    textoFecha: etiquetaDiaMes(c.fecha),
    total: c.total,
    textoTotal: pesos(c.total),
    tipo: uso !== null && (config === null || enConfig) ? (NOMBRE_USO[uso] ?? null) : null,
    estado: motivo === undefined ? 'sin_calcular' : motivo === null ? 'deducible' : 'no_deducible',
    motivo: motivo ?? null,
    textoMotivo: motivo ? TEXTO_MOTIVO_EXCLUSION[motivo] : null,
    pideAlumnoNivel: uso !== null && conAlumno.has(uso),
    alumno: g.etiquetas.alumno ?? null,
    nivel: g.etiquetas.nivel ?? null,
    ofreceLentes: uso === USO_LENTES,
    lentes: g.etiquetas.lentes === true,
    beneficiarioLentes:
      g.etiquetas.lentes === true ? (g.etiquetas.beneficiario ?? BENEFICIARIO_TITULAR) : null,
    textoBeneficiarioLentes:
      g.etiquetas.lentes === true
        ? etiquetaBeneficiario(g.etiquetas.beneficiario ?? BENEFICIARIO_TITULAR, beneficiarios)
        : null,
    marcadaCancelada: g.estatus === 'cancelado',
    enPagos: c.metodo_pago === 'PPD',
    pagoConfirmado: g.etiquetas.pagado === true ? formaConfirmada(g.etiquetas.forma_pago) : null,
  };
}

const anioDe = (fecha: PlainDate) => partes(fecha).anio;

/**
 * Pantalla de Deducciones del ejercicio (por omisión, el año de hoy). Sin perfil pide los datos; sin
 * parámetros validados (`config/fiscal/<año>.json` por validar) lista las facturas y lo explica sin cifras de
 * deducción; con todo, la estimación de E13.2 y el ahorro de E13.3.
 */
export function obtenerDeducciones(ctx: Contexto, ejercicioPedido?: number): VistaDeducciones {
  const ejercicio = ejercicioPedido ?? anioDe(ctx.reloj.hoy());
  const guardados = listarCfdiGuardados(ctx);
  const ejercicios = [
    ...new Set([anioDe(ctx.reloj.hoy()), ...guardados.map((g) => anioDe(g.leido.fecha))]),
  ].sort((a, b) => b - a);
  const delAnioTodos = guardados.filter((g) => anioDe(g.leido.fecha) === ejercicio);
  const delAnio = delAnioTodos.filter((g) => g.etiquetas.oculta !== true);
  const ocultasRaw = delAnioTodos.filter((g) => g.etiquetas.oculta === true);
  const beneficiariosLentes = opcionesBeneficiarioLentes(ctx);
  const perfil = obtenerPerfilFiscal(ctx);
  const carga = cargarConfigFiscal(ctx, ejercicio);
  const config = carga.estado === 'lista' ? carga.config : null;
  const comunes = { ejercicio, ejercicios, beneficiariosLentes };
  const mapFactura = (g: CfdiGuardado, motivo?: MotivoExclusion | null) =>
    factura(g, config, motivo, beneficiariosLentes);
  if (!perfil) {
    return {
      ...comunes,
      estado: 'sin_perfil',
      facturas: delAnio.map((g) => mapFactura(g, undefined)),
      ocultas: ocultasRaw.map((g) => mapFactura(g, undefined)),
    };
  }
  if (!config) {
    return {
      ...comunes,
      estado: 'sin_parametros',
      perfil,
      mensaje: MENSAJE_SIN_PARAMETROS,
      facturas: delAnio.map((g) => mapFactura(g, undefined)),
      ocultas: ocultasRaw.map((g) => mapFactura(g, undefined)),
    };
  }

  const cfdis: CfdiParaDeducir[] = delAnio.map((g) =>
    g.estatus === 'desconocido' ? g.leido : { ...g.leido, estatus: g.estatus },
  );
  const etiquetas = Object.fromEntries(delAnio.map((g) => [g.leido.uuid, g.etiquetas]));
  const r = estimarDeducciones(cfdis, perfil.ingresos, ejercicio, perfil.rfc, config.deducciones, etiquetas);
  const motivos = new Map(r.excluidos.map((e) => [e.uuid, e.motivo]));
  const facturas = delAnio.map((g) => mapFactura(g, motivos.get(g.leido.uuid) ?? null));
  const ocultas = ocultasRaw.map((g) => mapFactura(g, null));

  const porTipo = Object.entries(r.por_uso).map(([uso, u]) => {
    const nombre = NOMBRE_USO[uso] ?? uso;
    return {
      uso,
      nombre,
      facturas: u.cfdis,
      deducible: u.deducible,
      texto: `${nombre}: ${pesos(u.deducible)}`,
    };
  });
  let ahorro: Centavos | null = null;
  let textoAhorro =
    'Para estimar cuánto ISR pagarías de menos, agrega tu base gravable (viene en tu constancia de sueldos).';
  if (perfil.base_gravable !== null) {
    ahorro = ahorroPorDeducciones(
      perfil.base_gravable,
      r.total_deducible,
      config.tarifa_anual_isr,
    ).ahorro_estimado;
    // "Unos $X": pesos enteros hacia abajo, para no prometer de más (regla 12).
    textoAhorro = `Podrías pagar unos ${pesos(Math.floor(ahorro / 100) * 100)} menos de ISR`;
  }
  const niveles = Object.keys(
    Object.values(config.deducciones.usos).find((u) => u.tope_por_alumno_nivel)?.tope_por_alumno_nivel ?? {},
  ).map((valor) => ({ valor, etiqueta: NOMBRE_NIVEL[valor] ?? valor.replace(/_/g, ' ') }));

  return {
    ...comunes,
    estado: 'listo',
    perfil,
    facturas,
    ocultas,
    total: r.total_deducible,
    titulo: `Llevas ${pesos(r.total_deducible)} deducibles en ${ejercicio} (estimación)`,
    porTipo,
    noDeducibles: facturas.filter((f) => f.estado === 'no_deducible'),
    textoTope:
      r.excedente_perdido > 0
        ? `Llegaste al tope del año: ${pesos(r.excedente_perdido)} ya no cuentan.`
        : null,
    textoAhorro,
    ahorro,
    niveles,
    leyenda: LEYENDA_ESTIMACION,
  };
}

/** "Ya la pagué" de una factura en parcialidades: guarda la forma de pago real (E13-12). */
export function confirmarPagoFactura(ctx: Contexto, uuid: string, forma: FormaPagoConfirmado): void {
  const f = FORMAS_PAGO_CONFIRMADO.find((x) => x.valor === forma);
  if (!f) throw new ErrorDominio('forma_pago_invalida', 'forma de pago inválida');
  etiquetarCfdi(ctx, uuid, { pagado: true, forma_pago: f.codigo });
}

/** Alumno y nivel de una colegiatura. El nivel debe ser uno de los de la configuración del año. */
export function asignarAlumnoNivel(ctx: Contexto, uuid: string, alumno: string, nivel: string): void {
  const nombre = alumno.trim().replace(/\s+/g, ' ');
  if (nombre === '') throw new ErrorDominio('alumno_invalido', 'falta el alumno');
  etiquetarCfdi(ctx, uuid, { alumno: nombre, nivel });
}

/** "Son lentes ópticos": aplica el tope de lentes por beneficiario (el titular, si no se dice otro). */
export function marcarLentes(ctx: Contexto, uuid: string, lentes: boolean): void {
  if (lentes) etiquetarCfdi(ctx, uuid, { lentes: true });
  else etiquetarCfdi(ctx, uuid, { lentes: undefined, beneficiario: undefined });
}

/** Beneficiario del tope de lentes (debe ser una opción de `opcionesBeneficiarioLentes`). */
export function asignarBeneficiarioLentes(ctx: Contexto, uuid: string, beneficiario: string): void {
  const valido = opcionesBeneficiarioLentes(ctx).some((o) => o.valor === beneficiario);
  if (!valido) throw new ErrorDominio('beneficiario_invalido', 'beneficiario inválido');
  etiquetarCfdi(ctx, uuid, { lentes: true, beneficiario });
}

/** La cancelaron en el SAT: deja de contar (E13.2). */
export function marcarFacturaCancelada(ctx: Contexto, uuid: string, cancelada: boolean): void {
  actualizarEstatusCfdi(ctx, uuid, cancelada ? 'cancelado' : 'vigente');
}

/** "La importé por error": se oculta de la lista y de la estimación; el XML sigue guardado. */
export function ocultarFacturaImportada(ctx: Contexto, uuid: string): void {
  etiquetarCfdi(ctx, uuid, { oculta: true });
}

/** Vuelve a mostrar una factura oculta. */
export function recuperarFactura(ctx: Contexto, uuid: string): void {
  etiquetarCfdi(ctx, uuid, { oculta: undefined });
}

/** Aviso preventivo (`02 §24`, RF-FIS-03, CA-M12-04): al registrar salud en efectivo. */
export const AVISO_DEDUCIBLE_EFECTIVO =
  'Si lo pagas con tarjeta o transferencia y pides factura, lo puedes deducir.';

/** Categoría de los gastos de salud (`04 §3`): consulta, dentista, farmacia, laboratorio. */
const CATEGORIA_SALUD = 'salud';

/** Un gasto de salud que salió de una cuenta de efectivo: Hoy muestra el aviso preventivo. */
export function esSaludEnEfectivo(ctx: Contexto, e: EntradaMovimiento): boolean {
  if (e.tipo !== 'gasto' || e.categoria !== CATEGORIA_SALUD) return false;
  try {
    return cuentaPorId(ctx, e.origenId).subtipo === 'efectivo';
  } catch {
    return false;
  }
}
