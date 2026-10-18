import { z } from 'zod';
import { ErrorDominio, type Centavos, type PlainDate } from '@cartera/core';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import {
  interpretarReglas,
  normalizarAlias,
  type CodigoLimite,
  resolverCuenta,
  type ContextoInterprete,
  type CuentaResolutor,
  type GastoCompartido,
  type Interpretacion,
  type Movimiento,
  type RefCuenta,
  type ResultadoNube,
  type ResultadoResolutor,
} from '@cartera/nlu';
/** Escritura bloqueada en solo lectura vía `exigirConsentimiento` (captura, arqueo y demás servicios igual). */
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { aprenderAlias, categoriaAprendida } from './aprendizaje';
import { cuentaPorId, cuentasPropias, idCategoriaDe, type CuentaPropia } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import type { CoberturaAutomatica } from './cobertura';
import { gruposAbiertosConNombre } from './compartido';
import { respuestaSoloPlus, responderConsulta, tienePlantilla, type RespuestaConsulta } from './consultas';
import { funcionesPlan } from './plan';
import { configurarCicloPorVoz, type TarjetaEditada, type TarjetaPorAgregar } from './config-tarjetas';
import {
  anularPorVoz,
  aplicaDirecto,
  aplicarCorreccion,
  buscarDuplicados,
  buscarMovimientos,
  configurarCompromiso,
  resumenTransaccion,
  type CambiosResueltos,
  type CompromisoConfigurado,
  type ResumenTransaccion,
} from './correcciones';
import {
  registrarCuentaDividida,
  resolverParticipantes,
  type CuentaDivididaRegistrada,
  type EntradaCuentaDividida,
} from './cuenta-dividida';
import { registrarMovimiento, type EntradaMovimiento } from './formulario';
import {
  pasarAMeses,
  registrarCompraMsi,
  type CompraMsiRegistrada,
  type EntradaCompraMsi,
  type PreguntaLiquidar,
} from './msi';
import type { ConsultaMeAlcanza } from './me-alcanza';
import type { MovimientoVista } from './movimientos';
import { esSaludEnEfectivo } from './deducciones';
import { contextoNube, type NivelNube } from './nube';
import { contactosInterprete } from './personas';
import { borrarAjuste, escribirAjuste, leerAjuste, listarAjustes } from './preferencias';
import {
  aportarTanda,
  cobrarTanda,
  listarTandas,
  proponerTandaPorVoz,
  type MovimientoTanda,
  type PropuestaTanda,
} from './tandas';

/** Tope del registro optimista (`06 §7`): suma de montos ≤ $5,000. */
export const TOPE_OPTIMISTA: Centavos = 500_000;

export type OrigenDictado = 'voz' | 'texto';

/** Lo que muestra el aviso "Registré: Coca $25 · Antojos · Efectivo — Deshacer". */
export interface ResumenMovimiento {
  readonly transaccionId: string;
  readonly tipo: EntradaMovimiento['tipo'];
  readonly descripcion: string | null;
  readonly monto: Centavos;
  readonly categoria: string | null;
  readonly cuenta: string;
  readonly porAsignar: boolean;
  /** Pago fijo o ingreso que este movimiento cubrió solo (E3.5), o la pregunta si el monto no coincide. */
  readonly cobertura: CoberturaAutomatica | null;
  /** Un pago que dejó saldo a favor con meses activos (CA-M4-10). */
  readonly preguntaLiquidar: PreguntaLiquidar | null;
  /** Gasto de salud en efectivo: Hoy muestra el aviso preventivo de deducciones (`02 §24`, CA-M12-04). */
  readonly avisoDeducible: boolean;
}

/** Compra a meses dictada que necesita confirmación (monto alto, tarjeta ambigua o aproximada). */
export interface PropuestaCompraMsi {
  readonly entrada: Omit<EntradaCompraMsi, 'tarjetaId'> & { readonly tarjetaId?: string };
  /** Si falta, las tarjetas de crédito candidatas. */
  readonly faltaTarjeta: Omit<CuentaPorElegir, 'campo'> | null;
}

/**
 * Cuenta dividida dictada (`02 §17`): siempre se confirma, con chips de contactos para cada parte ("¿Con
 * quién?"). Los nombres dichos que coinciden con un contacto ya vienen elegidos.
 */
export interface PropuestaCuentaDividida {
  readonly total: Centavos;
  /** Partes contándote a ti; `null` si no lo dijo. */
  readonly partes: number | null;
  readonly categoria: string;
  readonly fecha: PlainDate;
  readonly descripcion: string | null;
  /** Con qué pagaste (o la cuenta puente "por asignar"); `null` si falta elegirla. */
  readonly origenId: string | null;
  readonly faltaOrigen: Omit<CuentaPorElegir, 'campo'> | null;
  /** Contactos reconocidos entre los nombres dichos. */
  readonly personaIds: readonly string[];
  /** Nombres dichos que no son de ningún contacto (o de varios): "¿Lo agrego?". */
  readonly sinResolver: readonly string[];
}

/**
 * Gasto compartido dictado (`02 §27`): siempre se confirma antes de compartirlo; "Guardar" llama
 * `agregarGastoCompartido`. Lo que no se dijo (quién pagó, con quién si hay varios grupos) lo pregunta la tarjeta.
 */
/** Aportación o cobro de tanda dictado que necesita confirmación (varias tandas, cuenta ambigua, aproximado o monto alto). */
export interface PropuestaTandaConfirmar {
  readonly tipo: 'aportacion_tanda' | 'cobro_tanda';
  readonly monto: Centavos;
  readonly fecha: PlainDate;
  /** Si solo hay una tanda activa, ya viene elegida. */
  readonly tandaId: string | null;
  readonly tandas: readonly { readonly id: string; readonly nombre: string }[];
  readonly cuentaId: string | null;
  readonly faltaCuenta: Omit<CuentaPorElegir, 'campo'> | null;
  readonly claveIdempotencia?: string;
}

export interface PropuestaGastoCompartido {
  readonly total: Centavos;
  readonly descripcion: string | null;
  readonly categoria: string;
  readonly fecha: PlainDate;
  /** `null` si no dijo quién pagó. */
  readonly pagueYo: boolean | null;
  /** Tu parte en puntos base: 5000 = mitad y mitad; 6000 = pones 60 %. */
  readonly miParteBp: number;
  /** `null` si hay varios grupos abiertos y no quedó claro con quién. */
  readonly grupoId: string | null;
  readonly grupos: readonly { readonly id: string; readonly nombre: string }[];
}

/** Cuenta que falta elegir en la tarjeta de confirmación. */
export interface CuentaPorElegir {
  readonly campo: 'origenId' | 'destinoId';
  readonly motivo: 'ambigua' | 'no_encontrada' | 'aproximado';
  /** Alias dicho (para "No tengo una cuenta «azul». ¿La agrego?"). */
  readonly alias: string | null;
  readonly candidatas: readonly { readonly id: string; readonly nombre: string }[];
}

/** Movimiento interpretado que necesita confirmación (`02 §5`, `06 §7`). */
export interface PropuestaMovimiento {
  /** Lo que ya se sabe, con las cuentas que sí se resolvieron. */
  readonly entrada: Partial<EntradaMovimiento> & {
    readonly tipo: EntradaMovimiento['tipo'];
    readonly monto: Centavos;
  };
  readonly faltan: readonly CuentaPorElegir[];
}

/** Por qué una frase quedó "por interpretar". */
export type MotivoPorInterpretar = 'sin_nube' | 'sin_red' | 'limite' | 'error';

/**
 * Lo que el intérprete entendió pero esta versión todavía no hace por voz. `movimiento_compartido`: anular o
 * corregir un gasto compartido se hace desde Gastos compartidos, para que el cambio le llegue a tu pareja (M16).
 */
export type MotivoNoSoportado =
  | 'tipo_movimiento'
  | 'intencion'
  | 'ajuste'
  | 'consulta'
  | 'meses_sin_tarjeta'
  | 'correccion'
  | 'movimiento_compartido';

export type AccionElegir = 'corregir' | 'anular' | 'pasar_a_meses';

export type ResultadoTexto =
  | {
      readonly resultado: 'registrado';
      /** Token de "Deshacer" (5 s). */
      readonly deshacer: string;
      readonly movimientos: readonly ResumenMovimiento[];
    }
  | {
      readonly resultado: 'confirmar';
      readonly motivo: 'monto_alto' | 'cuenta' | 'aproximado' | 'impuestos';
      readonly propuestas: readonly PropuestaMovimiento[];
    }
  /** "Lo guardé; lo interpreto cuando tengas internet." */
  | {
      readonly resultado: 'por_interpretar';
      readonly id: string;
      readonly motivo: MotivoPorInterpretar;
      /** Con `motivo: 'limite'`: cuál se agotó (CA-M7-02: el mensaje del mes es distinto al del día). */
      readonly limite?: CodigoLimite;
    }
  /** Consulta tipada (`06 §6`): respuesta en plantilla y el filtro de "Ver movimientos". */
  | { readonly resultado: 'consulta'; readonly respuesta: RespuestaConsulta }
  /** "¿Me alcanza para unos tenis de 1,500?": la pantalla abre "¿Me alcanza?" y llama `meAlcanza(ctx, consulta)`. */
  | { readonly resultado: 'me_alcanza'; readonly consulta: ConsultaMeAlcanza }
  /** Pregunta abierta (Q13, `06 §6`): la pantalla llama `explicar(ctx, pregunta, { nube })` (Plus). */
  | { readonly resultado: 'explicar'; readonly pregunta: string }
  /** "Traigo 300": abre el arqueo con lo que dijo (`02 §7`); nada se registra sin confirmar (E7). */
  | { readonly resultado: 'arqueo'; readonly efectivoReal: Centavos }
  | {
      readonly resultado: 'corregido';
      readonly antes: ResumenTransaccion;
      readonly despues: ResumenTransaccion;
      readonly deshacer: string;
    }
  | { readonly resultado: 'anulado'; readonly movimiento: ResumenTransaccion; readonly deshacer: string }
  | {
      readonly resultado: 'pasar_a_meses';
      /** La compra a meses que reemplazó al cargo (CA-M4-09). */
      readonly movimiento: ResumenTransaccion;
      readonly meses: number;
      readonly planId: string;
      readonly deshacer: string;
    }
  /** Compra a meses registrada (CA-M4-06): plan, calendario y compromiso por mes. */
  | { readonly resultado: 'registrado_msi'; readonly compra: CompraMsiRegistrada; readonly deshacer: string }
  /** Compra a meses que necesita confirmación; "Guardar" llama `confirmarCompraMsi`. */
  | {
      readonly resultado: 'confirmar_msi';
      readonly motivo: 'monto_alto' | 'cuenta' | 'aproximado';
      readonly propuesta: PropuestaCompraMsi;
    }
  /** Cuenta dividida dictada: "Guardar" llama `confirmarCuentaDividida` (CA-M8-01). */
  | { readonly resultado: 'confirmar_division'; readonly propuesta: PropuestaCuentaDividida }
  /** Gasto compartido con la pareja dictado: "Guardar" llama `agregarGastoCompartido` (`02 §27`). */
  | { readonly resultado: 'confirmar_compartido'; readonly propuesta: PropuestaGastoCompartido }
  /** Gasto compartido dictado sin ningún grupo abierto: primero hay que vincularse. */
  | { readonly resultado: 'sin_pareja' }
  | {
      readonly resultado: 'registrado_division';
      readonly registro: CuentaDivididaRegistrada;
      readonly total: Centavos;
      readonly descripcion: string | null;
      readonly deshacer: string;
    }
  /** "Mi Nu corta el 28 y pago el 18" sobre una tarjeta existente. */
  | {
      readonly resultado: 'tarjeta_configurada';
      readonly tarjeta: string;
      readonly editada: TarjetaEditada;
      readonly deshacer: string | null;
    }
  /** La tarjeta dictada no existe: abrir el formulario prellenado (el saldo es obligatorio). */
  | {
      readonly resultado: 'tarjeta_por_agregar';
      readonly prellenado: TarjetaPorAgregar;
      readonly candidatas: readonly { readonly id: string; readonly nombre: string }[];
    }
  /** Varias coincidencias, una de hace más de 48 h, o falta la cuenta nueva: chips para elegir (`06 §7`). */
  | {
      readonly resultado: 'elegir';
      readonly accion: AccionElegir;
      readonly candidatos: readonly MovimientoVista[];
      readonly cambios?: CambiosResueltos;
      readonly meses?: number;
      readonly faltaCuenta?: CuentaPorElegir;
    }
  | { readonly resultado: 'no_encontrado'; readonly accion: AccionElegir | 'duplicados' }
  | { readonly resultado: 'duplicados'; readonly grupos: readonly (readonly MovimientoVista[])[] }
  | { readonly resultado: 'configurado'; readonly compromiso: CompromisoConfigurado }
  /** TK01 "entré a una tanda…": formulario prellenado con el calendario de E11; "Guardar" llama `crearTanda`. */
  | { readonly resultado: 'tanda_por_crear'; readonly propuesta: PropuestaTanda }
  /** "Di mi tanda" / "me tocó la tanda" (TK02) que necesita confirmación; "Guardar" llama `confirmarTanda`. */
  | {
      readonly resultado: 'confirmar_tanda';
      readonly motivo: 'monto_alto' | 'cuenta' | 'aproximado' | 'tanda';
      readonly propuesta: PropuestaTandaConfirmar;
    }
  /** "Di mi tanda" / "me tocó la tanda" (TK02) con una sola tanda activa: ni gasto ni ingreso. */
  | {
      readonly resultado: 'registrado_tanda';
      readonly tipo: 'aportacion_tanda' | 'cobro_tanda';
      readonly movimiento: MovimientoTanda;
    }
  | {
      readonly resultado: 'aclarar';
      readonly motivo: Extract<Interpretacion, { intencion: 'aclarar' }>['motivo'];
      readonly pregunta: string;
      readonly opciones: readonly string[];
      /** La frase original, para volver a mandarla con la opción elegida. */
      readonly texto: string;
    }
  /** `texto_largo`: la frase pasa de 500 caracteres y no viaja a la nube ("Dilo más corto"). */
  | { readonly resultado: 'no_entendi'; readonly motivo?: 'texto_largo' }
  | { readonly resultado: 'no_soportado'; readonly motivo: MotivoNoSoportado }
  | {
      readonly resultado: 'fuera_de_alcance';
      readonly motivo: Extract<Interpretacion, { intencion: 'fuera_de_alcance' }>['motivo'] | null;
    };

/** Resultados que ya escribieron algo (o que no necesitan a la persona): la cola los da por terminados. */
const AUTOMATICOS = new Set<ResultadoTexto['resultado']>([
  'registrado',
  'registrado_msi',
  'registrado_division',
  'registrado_tanda',
  'tarjeta_configurada',
  'corregido',
  'anulado',
  'pasar_a_meses',
  'configurado',
  'consulta',
  'me_alcanza',
  'explicar',
]);

/** La cola no las aplica sola: cambian lo ya registrado y la persona tiene que verlo, con Deshacer (`06 §7`). */
const SOLO_CON_LA_PERSONA = new Set<Interpretacion['intencion']>(['anular', 'corregir']);

/** Texto máximo de `POST /nlu/interpretar` (`TEXTO_MAXIMO_NUBE` de `@cartera/nlu`): más largo es un 400. */
const TEXTO_MAXIMO_NUBE = 500;

function tipoResolutor(c: CuentaPropia): CuentaResolutor['tipo'] | null {
  switch (c.subtipo) {
    case 'efectivo':
      return 'efectivo';
    case 'debito':
      return 'debito';
    case 'billetera':
      return 'billetera';
    case 'tarjeta_credito':
      return 'credito';
    default:
      return null; // ahorro: no se paga ni se cobra con ella desde una frase
  }
}

function cuentasResolutor(ctx: Contexto): CuentaResolutor[] {
  const salida: CuentaResolutor[] = [];
  for (const c of cuentasPropias(ctx)) {
    const tipo = tipoResolutor(c);
    if (tipo) salida.push({ id: c.id, tipo, nombre: c.nombre, alias: c.alias, espacio: 'personal' });
  }
  return salida;
}

/** Contexto mínimo del nivel 0 (`06 §4`): tipos y alias de cuentas, alias de contactos, fecha. */
export function contextoInterprete(
  ctx: Contexto,
  cuentas: readonly CuentaResolutor[] = cuentasResolutor(ctx),
  fecha: PlainDate = ctx.reloj.hoy(),
): ContextoInterprete {
  return {
    fecha_referencia: fecha,
    espacios: ['personal'],
    cuentas: cuentas.map((c) => ({ tipo: c.tipo, alias: c.alias, espacio: 'personal' })),
    contactos: contactosInterprete(ctx),
  };
}

type Resuelta = { id: string } | { falta: Omit<CuentaPorElegir, 'campo'> };

function resolver(
  ref: RefCuenta | undefined,
  sentido: 'sale' | 'entra',
  cuentas: readonly CuentaResolutor[],
  permitePuente: boolean,
): Resuelta {
  const r: ResultadoResolutor = resolverCuenta(
    ref
      ? { tipo: ref.tipo, ...(ref.alias !== undefined ? { alias: ref.alias } : {}) }
      : { tipo: 'desconocido' },
    cuentas,
  );
  const nombre = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? '';
  const todas = cuentas.map((c) => ({ id: c.id, nombre: c.nombre }));
  switch (r.resultado) {
    case 'cuenta':
      return r.aproximado
        ? {
            falta: {
              motivo: 'aproximado',
              alias: ref?.alias ?? null,
              candidatas: [{ id: r.cuenta, nombre: nombre(r.cuenta) }],
            },
          }
        : { id: r.cuenta };
    case 'por_asignar':
      if (permitePuente) {
        return { id: sentido === 'sale' ? CUENTAS_SISTEMA.porAsignar : CUENTAS_SISTEMA.porAsignarEntradas };
      }
      return { falta: { motivo: 'ambigua', alias: null, candidatas: todas } };
    case 'ambigua':
      return {
        falta: {
          motivo: 'ambigua',
          alias: ref?.alias ?? null,
          candidatas: r.candidatas.map((id) => ({ id, nombre: nombre(id) })),
        },
      };
    case 'no_encontrada':
      return { falta: { motivo: 'no_encontrada', alias: ref?.alias ?? null, candidatas: todas } };
  }
}

/** Convierte un movimiento interpretado en una entrada del formulario, o `null` si su tipo aún no se registra. */
function aPropuesta(
  ctx: Contexto,
  m: Movimiento,
  cuentas: readonly CuentaResolutor[],
): PropuestaMovimiento | null {
  const base = { monto: m.monto, fecha: m.fecha, ...(m.descripcion ? { descripcion: m.descripcion } : {}) };
  const faltan: CuentaPorElegir[] = [];
  const cuenta = (campo: CuentaPorElegir['campo'], r: Resuelta): Record<string, string> => {
    if ('id' in r) return { [campo]: r.id };
    faltan.push({ campo, ...r.falta });
    return {};
  };
  // Lo que la persona enseñó al corregir (`06 §12`) gana sobre lo que dijo el intérprete.
  const categoria = (slug: string | undefined, naturaleza: 'gasto' | 'ingreso', porOmision: string) => {
    const aprendida = categoriaAprendida(ctx, null, m.descripcion, naturaleza);
    if (aprendida) return aprendida;
    if (!slug) return porOmision;
    try {
      idCategoriaDe(ctx, slug, naturaleza);
      return slug;
    } catch {
      return porOmision;
    }
  };
  if ((m.espacio ?? 'personal') !== 'personal') return null; // negocio: M11
  switch (m.tipo) {
    case 'gasto':
      if (m.contraparte !== undefined || m.msi !== undefined || m.division !== undefined) return null;
      return {
        entrada: {
          tipo: 'gasto',
          ...base,
          categoria: categoria(m.categoria, 'gasto', 'otros_gastos'),
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, true)),
        },
        faltan,
      };
    case 'ingreso':
      return {
        entrada: {
          tipo: 'ingreso',
          ...base,
          categoria: categoria(m.categoria, 'ingreso', 'otros_ingresos'),
          ...cuenta('destinoId', resolver(m.destino, 'entra', cuentas, true)),
        },
        faltan,
      };
    case 'retiro_efectivo':
      return {
        entrada: {
          tipo: 'retiro_efectivo',
          ...base,
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, false)),
          ...cuenta('destinoId', resolver(m.destino ?? { tipo: 'efectivo' }, 'entra', cuentas, false)),
        },
        faltan,
      };
    case 'transferencia':
      return {
        entrada: {
          tipo: 'transferencia',
          ...base,
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, false)),
          ...cuenta('destinoId', resolver(m.destino, 'entra', cuentas, false)),
        },
        faltan,
      };
    case 'pago_tarjeta':
      return {
        entrada: {
          tipo: 'pago_tarjeta',
          ...base,
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, true)),
          ...cuenta('destinoId', resolver(m.destino, 'entra', cuentas, false)),
        },
        faltan,
      };
    default:
      return null;
  }
}

function resumir(
  ctx: Contexto,
  r: {
    transaccionId: string;
    cobertura: CoberturaAutomatica | null;
    preguntaLiquidar: PreguntaLiquidar | null;
  },
  e: EntradaMovimiento,
): ResumenMovimiento {
  const cuentaId = 'origenId' in e ? e.origenId : e.destinoId;
  return {
    transaccionId: r.transaccionId,
    cobertura: r.cobertura,
    preguntaLiquidar: r.preguntaLiquidar,
    tipo: e.tipo,
    descripcion: e.descripcion ?? null,
    monto: e.monto,
    categoria:
      'categoria' in e
        ? cuentaPorId(ctx, idCategoriaDe(ctx, e.categoria, e.tipo === 'gasto' ? 'gasto' : 'ingreso')).nombre
        : null,
    cuenta: cuentaPorId(ctx, cuentaId).nombre,
    porAsignar: cuentaId === CUENTAS_SISTEMA.porAsignar || cuentaId === CUENTAS_SISTEMA.porAsignarEntradas,
    avisoDeducible: esSaludEnEfectivo(ctx, e),
  };
}

/** Datos de la frase que se está interpretando. */
interface Frase {
  readonly texto: string;
  readonly origen: OrigenDictado;
  /** Fecha en que se dijo: la de hoy, o la guardada si viene de "por interpretar". */
  readonly fecha: PlainDate;
  /** Id en "por interpretar": hace idempotente el registro al procesar la cola. */
  readonly fraseId?: string;
}

function registrarInterpretado(
  ctx: Contexto,
  movimientos: readonly Movimiento[],
  cuentas: readonly CuentaResolutor[],
  frase: Frase,
): ResultadoTexto | null {
  const divididas = movimientos.filter((m) => m.tipo === 'cuenta_dividida' || m.division !== undefined);
  if (divididas.length > 0) {
    const [unico] = movimientos;
    // Una cuenta dividida se confirma sola (una frase con varias cosas no se registra por voz).
    if (movimientos.length > 1 || !unico) return null;
    return proponerCuentaDividida(ctx, unico, cuentas);
  }
  const tanda = registrarTandaInterpretada(ctx, movimientos, cuentas, frase);
  if (tanda !== undefined) return tanda;
  const msi = movimientos.filter(
    (m) => m.tipo === 'compra_msi' || (m.tipo === 'gasto' && m.msi !== undefined),
  );
  if (msi.length > 0) {
    const [unico] = movimientos;
    // Una compra a meses se registra sola (una frase con varias cosas va al formulario).
    if (movimientos.length > 1 || !unico) return null;
    return registrarMsiInterpretado(ctx, unico, cuentas, frase);
  }
  const propuestas: PropuestaMovimiento[] = [];
  for (const m of movimientos) {
    const p = aPropuesta(ctx, m, cuentas);
    if (!p) return null;
    propuestas.push(p);
  }
  // Política de confirmación (`06 §7`).
  if (propuestas.some((p) => p.faltan.length > 0)) {
    const soloAproximado = propuestas.every((p) => p.faltan.every((f) => f.motivo === 'aproximado'));
    return { resultado: 'confirmar', motivo: soloAproximado ? 'aproximado' : 'cuenta', propuestas };
  }
  if (movimientos.some((m) => m.aproximado))
    return { resultado: 'confirmar', motivo: 'aproximado', propuestas };
  if (movimientos.some((m) => m.tipo === 'gasto' && m.categoria === 'impuestos')) {
    return { resultado: 'confirmar', motivo: 'impuestos', propuestas };
  }
  const total = movimientos.reduce((s, m) => s + m.monto, 0);
  if (total > TOPE_OPTIMISTA) return { resultado: 'confirmar', motivo: 'monto_alto', propuestas };
  return confirmarRegistro(
    ctx,
    propuestas.map((p) => p.entrada as EntradaMovimiento),
    frase.origen,
    frase.fraseId ? { claveBase: `frase:${frase.fraseId}` } : {},
  );
}

function proponerCuentaDividida(
  ctx: Contexto,
  m: Movimiento,
  cuentas: readonly CuentaResolutor[],
): ResultadoTexto | null {
  if ((m.espacio ?? 'personal') !== 'personal' || m.msi || m.contraparte !== undefined) return null;
  if (m.tipo !== 'cuenta_dividida' && m.tipo !== 'gasto') return null;
  const r = resolver(m.origen, 'sale', cuentas, true);
  const aprendida = categoriaAprendida(ctx, null, m.descripcion, 'gasto');
  let categoria = aprendida ?? m.categoria ?? 'otros_gastos';
  try {
    idCategoriaDe(ctx, categoria, 'gasto');
  } catch {
    categoria = 'otros_gastos';
  }
  const { personaIds, sinResolver } = resolverParticipantes(ctx, m.division?.participantes ?? []);
  return {
    resultado: 'confirmar_division',
    propuesta: {
      total: m.monto,
      partes: m.division?.partes ?? null,
      categoria,
      fecha: m.fecha,
      descripcion: m.descripcion ?? null,
      origenId: 'id' in r ? r.id : null,
      faltaOrigen: 'id' in r ? null : r.falta,
      personaIds,
      sinResolver,
    },
  };
}

/**
 * Gasto compartido dictado (`02 §27`): con un solo grupo abierto (o el que coincide con el nombre dicho) ya va
 * elegido; con varios, la tarjeta pregunta con quién; sin ninguno, primero hay que vincularse. Nada se escribe hasta
 * "Guardar".
 */
function proponerGastoCompartido(ctx: Contexto, g: GastoCompartido): ResultadoTexto {
  const grupos = gruposAbiertosConNombre(ctx);
  if (grupos.length === 0) return { resultado: 'sin_pareja' };
  const dicho = g.grupo === undefined ? '' : normalizarAlias(g.grupo);
  const [unico, otro] = dicho === '' ? grupos : grupos.filter((x) => normalizarAlias(x.nombre) === dicho);
  const aprendida = categoriaAprendida(ctx, null, g.descripcion, 'gasto');
  let categoria = aprendida ?? g.categoria ?? 'otros_gastos';
  try {
    idCategoriaDe(ctx, categoria, 'gasto');
  } catch {
    categoria = 'otros_gastos';
  }
  const descripcion = g.descripcion?.trim() ?? '';
  return {
    resultado: 'confirmar_compartido',
    propuesta: {
      total: g.monto,
      descripcion: descripcion === '' ? null : descripcion.charAt(0).toUpperCase() + descripcion.slice(1),
      categoria,
      fecha: g.fecha,
      pagueYo: g.pagador === undefined ? null : g.pagador === 'yo',
      miParteBp: (g.mi_parte ?? 50) * 100,
      grupoId: unico && !otro ? unico.id : null,
      grupos,
    },
  };
}

/**
 * "Guardar" de la confirmación de una cuenta dividida dictada (o del formulario): tu parte a gasto y cada amigo
 * en "Te deben" (CA-M8-01). Devuelve el token de Deshacer. El alias de una cuenta que no se reconoció se aprende.
 */
export function confirmarCuentaDividida(
  ctx: Contexto,
  entrada: EntradaCuentaDividida,
  origen: OrigenDictado | 'manual',
  opciones: { claveIdempotencia?: string; aprender?: { alias: string } } = {},
): Extract<ResultadoTexto, { resultado: 'registrado_division' }> {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const registro = registrarCuentaDividida(ctx, entrada, {
      origen,
      ...(opciones.claveIdempotencia ? { claveIdempotencia: opciones.claveIdempotencia } : {}),
    });
    if (opciones.aprender) aprenderAlias(ctx, opciones.aprender.alias, entrada.origenId);
    return {
      resultado: 'registrado_division',
      registro,
      total: entrada.total,
      descripcion: entrada.descripcion?.trim() || null,
      deshacer: registro.deshacer,
    };
  });
}

function motivoConfirmarTanda(
  m: Movimiento,
  tandas: number,
): Extract<ResultadoTexto, { resultado: 'confirmar_tanda' }>['motivo'] {
  if (m.monto > TOPE_OPTIMISTA) return 'monto_alto';
  if (m.aproximado) return 'aproximado';
  if (tandas > 1) return 'tanda';
  return 'cuenta';
}

/**
 * Aportación o cobro de tanda dictados (`06 §3`, TK02): con una sola tanda activa, cuenta resuelta y sin
 * confirmación pendiente (`06 §7`) se registra directo; si no, tarjeta `confirmar_tanda` (o `null` sin tandas).
 * `undefined` si la frase no habla de tandas.
 */
function registrarTandaInterpretada(
  ctx: Contexto,
  movimientos: readonly Movimiento[],
  cuentas: readonly CuentaResolutor[],
  frase: Frase,
): ResultadoTexto | null | undefined {
  if (!movimientos.some((m) => m.tipo === 'aportacion_tanda' || m.tipo === 'cobro_tanda')) return undefined;
  const [m] = movimientos;
  if (movimientos.length !== 1 || !m || (m.espacio ?? 'personal') !== 'personal') return null;
  if (m.tipo !== 'aportacion_tanda' && m.tipo !== 'cobro_tanda') return null;

  const esCobro = m.tipo === 'cobro_tanda';
  const tandas = listarTandas(ctx).map((t) => ({ id: t.id, nombre: t.nombre }));
  const tandaId = tandas.length === 1 ? (tandas[0]?.id ?? null) : null;
  const r = resolver(esCobro ? m.destino : m.origen, esCobro ? 'entra' : 'sale', cuentas, true);
  const cuentaId = 'id' in r ? r.id : null;
  const faltaCuenta = 'falta' in r ? r.falta : null;
  const necesitaConfirmar =
    m.aproximado || m.monto > TOPE_OPTIMISTA || tandas.length !== 1 || faltaCuenta !== null;

  if (necesitaConfirmar) {
    if (tandas.length === 0) return null;
    return {
      resultado: 'confirmar_tanda',
      motivo: motivoConfirmarTanda(m, tandas.length),
      propuesta: {
        tipo: m.tipo,
        monto: m.monto,
        fecha: m.fecha,
        tandaId,
        tandas,
        cuentaId,
        faltaCuenta,
        ...(frase.fraseId ? { claveIdempotencia: `frase:${frase.fraseId}:0` } : {}),
      },
    };
  }

  if (!tandaId || !cuentaId) return null;
  const comunes = {
    tandaId,
    cuentaId,
    monto: m.monto,
    origen: frase.origen,
    ...(frase.fraseId ? { claveIdempotencia: `frase:${frase.fraseId}:0` } : {}),
  };
  const movimiento = esCobro
    ? cobrarTanda(ctx, { ...comunes, fecha: m.fecha })
    : aportarTanda(ctx, { ...comunes, fechaPago: m.fecha });
  return { resultado: 'registrado_tanda', tipo: m.tipo, movimiento };
}

/**
 * "Guardar" de la confirmación de aportación o cobro de tanda dictado (TK02). Devuelve el token de Deshacer.
 */
export function confirmarTanda(
  ctx: Contexto,
  entrada: {
    readonly tandaId: string;
    readonly cuentaId: string;
    readonly monto: Centavos;
    readonly tipo: 'aportacion_tanda' | 'cobro_tanda';
    readonly fecha: PlainDate;
    readonly claveIdempotencia?: string;
  },
  origen: OrigenDictado,
  opciones: { aprender?: { alias: string } } = {},
): Extract<ResultadoTexto, { resultado: 'registrado_tanda' }> {
  exigirConsentimiento(ctx);
  const esCobro = entrada.tipo === 'cobro_tanda';
  const comunes = {
    tandaId: entrada.tandaId,
    cuentaId: entrada.cuentaId,
    monto: entrada.monto,
    origen,
    ...(entrada.claveIdempotencia ? { claveIdempotencia: entrada.claveIdempotencia } : {}),
  };
  const movimiento = esCobro
    ? cobrarTanda(ctx, { ...comunes, fecha: entrada.fecha })
    : aportarTanda(ctx, { ...comunes, fechaPago: entrada.fecha });
  if (opciones.aprender) aprenderAlias(ctx, opciones.aprender.alias, entrada.cuentaId);
  return { resultado: 'registrado_tanda', tipo: entrada.tipo, movimiento };
}

function registrarMsiInterpretado(
  ctx: Contexto,
  m: Movimiento,
  cuentas: readonly CuentaResolutor[],
  frase: Frase,
): ResultadoTexto | null {
  if ((m.espacio ?? 'personal') !== 'personal' || !m.msi || m.msi.meses < 2 || m.contraparte || m.division) {
    return null;
  }
  const credito = cuentas.filter((c) => c.tipo === 'credito');
  const r = resolver(m.origen ?? { tipo: 'credito' }, 'sale', credito, false);
  const aprendida = categoriaAprendida(ctx, null, m.descripcion, 'gasto');
  let categoria = aprendida ?? m.categoria ?? 'otros_gastos';
  try {
    idCategoriaDe(ctx, categoria, 'gasto');
  } catch {
    categoria = 'otros_gastos';
  }
  const entrada = {
    monto: m.monto,
    meses: m.msi.meses,
    fecha: m.fecha,
    categoria,
    ...(m.descripcion ? { descripcion: m.descripcion } : {}),
  };
  const conTarjeta = 'id' in r ? { ...entrada, tarjetaId: r.id } : entrada;
  if (!('id' in r)) {
    return {
      resultado: 'confirmar_msi',
      motivo: r.falta.motivo === 'aproximado' ? 'aproximado' : 'cuenta',
      propuesta: { entrada: conTarjeta, faltaTarjeta: r.falta },
    };
  }
  if (m.aproximado)
    return {
      resultado: 'confirmar_msi',
      motivo: 'aproximado',
      propuesta: { entrada: conTarjeta, faltaTarjeta: null },
    };
  if (m.monto > TOPE_OPTIMISTA) {
    return {
      resultado: 'confirmar_msi',
      motivo: 'monto_alto',
      propuesta: { entrada: conTarjeta, faltaTarjeta: null },
    };
  }
  return confirmarCompraMsi(
    ctx,
    { ...entrada, tarjetaId: r.id },
    frase.origen,
    frase.fraseId ? { claveIdempotencia: `frase:${frase.fraseId}:0` } : {},
  );
}

/**
 * "Guardar" de la confirmación de una compra a meses (o el registro optimista): gasto completo en su categoría,
 * plan y calendario (CA-M4-06). Devuelve el token de Deshacer.
 */
export function confirmarCompraMsi(
  ctx: Contexto,
  entrada: EntradaCompraMsi,
  origen: OrigenDictado | 'manual',
  opciones: { claveIdempotencia?: string; aprender?: { alias: string } } = {},
): Extract<ResultadoTexto, { resultado: 'registrado_msi' }> {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const compra = registrarCompraMsi(ctx, entrada, {
      origen,
      ...(opciones.claveIdempotencia ? { claveIdempotencia: opciones.claveIdempotencia } : {}),
    });
    if (opciones.aprender) aprenderAlias(ctx, opciones.aprender.alias, compra.tarjetaId);
    return { resultado: 'registrado_msi', compra, deshacer: compra.deshacer };
  });
}

function corregirInterpretado(
  ctx: Contexto,
  i: Extract<Interpretacion, { intencion: 'corregir' }>,
  cuentas: readonly CuentaResolutor[],
  frase: Frase,
): ResultadoTexto {
  const { msi, origen, ...resto } = i.cambios;
  const cambios: { -readonly [K in keyof CambiosResueltos]: CambiosResueltos[K] } = { ...resto };
  let faltaCuenta: CuentaPorElegir | undefined;
  if (origen) {
    const r = resolver(origen, 'sale', cuentas, false);
    if ('id' in r) {
      cambios.origenId = r.id;
      cambios.aliasDicho = origen.alias ?? null;
    } else {
      faltaCuenta = { campo: 'origenId', ...r.falta };
    }
  }
  const soloMeses = msi !== undefined && Object.keys(i.cambios).length === 1;
  const accion: AccionElegir = soloMeses ? 'pasar_a_meses' : 'corregir';
  const candidatos = buscarMovimientos(ctx, i.objetivo, frase.fecha);
  if (candidatos.length === 0) return { resultado: 'no_encontrado', accion };
  const [unico] = candidatos;
  if (unico && aplicaDirecto(ctx, candidatos) && !faltaCuenta) {
    return aplicarEleccion(
      ctx,
      { accion, transaccionId: unico.id, cambios, ...(msi ? { meses: msi.meses } : {}) },
      frase.origen,
      frase.fraseId,
    );
  }
  return {
    resultado: 'elegir',
    accion,
    candidatos,
    cambios,
    ...(msi ? { meses: msi.meses } : {}),
    ...(faltaCuenta ? { faltaCuenta } : {}),
  };
}

/** Lo que eligió la persona en la tarjeta de "elegir" (o lo que la política aplicó directo). */
export interface Eleccion {
  readonly accion: AccionElegir;
  readonly transaccionId: string;
  readonly cambios?: CambiosResueltos;
  readonly meses?: number;
}

/**
 * Aplica una corrección, anulación o "pasar a meses" sobre el movimiento elegido. Devuelve el resultado con su
 * token de "Deshacer".
 */
export function aplicarEleccion(
  ctx: Contexto,
  e: Eleccion,
  origen: OrigenDictado,
  fraseId?: string,
): ResultadoTexto {
  exigirConsentimiento(ctx);
  try {
    switch (e.accion) {
      case 'anular': {
        const r = anularPorVoz(ctx, e.transaccionId);
        return { resultado: 'anulado', ...r };
      }
      case 'pasar_a_meses': {
        const r = pasarAMeses(ctx, e.transaccionId, e.meses ?? 0, { origen });
        return {
          resultado: 'pasar_a_meses',
          movimiento: resumenTransaccion(ctx, r.transaccionId),
          meses: r.meses,
          planId: r.planId,
          deshacer: r.deshacer,
        };
      }
      case 'corregir': {
        const { ...cambios } = e.cambios ?? {};
        if (Object.keys(cambios).filter((k) => k !== 'aliasDicho').length === 0) {
          if (e.meses) return aplicarEleccion(ctx, { ...e, accion: 'pasar_a_meses' }, origen, fraseId);
          return { resultado: 'no_soportado', motivo: 'correccion' };
        }
        const r = aplicarCorreccion(ctx, e.transaccionId, cambios, {
          origen,
          ...(fraseId ? { claveIdempotencia: `corr:frase:${fraseId}` } : {}),
        });
        if (e.meses) {
          const m = pasarAMeses(ctx, r.despues.transaccionId, e.meses, { origen });
          // Deshacer vuelve al cargo de antes de la corrección.
          return {
            resultado: 'corregido',
            antes: r.antes,
            despues: resumenTransaccion(ctx, m.transaccionId),
            deshacer: `m:${m.transaccionId}:${e.transaccionId}`,
          };
        }
        return { resultado: 'corregido', ...r };
      }
    }
  } catch (error) {
    if (error instanceof ErrorDominio) {
      if (error.codigo === 'meses_sin_tarjeta')
        return { resultado: 'no_soportado', motivo: 'meses_sin_tarjeta' };
      if (error.codigo === 'meses_invalidos') return { resultado: 'no_soportado', motivo: 'correccion' };
      if (error.codigo === 'correccion_no_soportada' || error.codigo === 'patron_invalido') {
        return { resultado: 'no_soportado', motivo: 'correccion' };
      }
      if (error.codigo === 'movimiento_compartido') {
        return { resultado: 'no_soportado', motivo: 'movimiento_compartido' };
      }
    }
    throw error;
  }
}

/**
 * Aplica una `Interpretacion` ya validada (nivel 0 o nube): resolutor → política de confirmación (`06 §7`) →
 * servicios. Síncrono: todo ocurre en la base local.
 */
function aplicarInterpretacion(
  ctx: Contexto,
  i: Interpretacion,
  cuentas: readonly CuentaResolutor[],
  frase: Frase,
): ResultadoTexto {
  switch (i.intencion) {
    case 'registrar':
      return (
        registrarInterpretado(ctx, i.movimientos, cuentas, frase) ?? {
          resultado: 'no_soportado',
          motivo: 'tipo_movimiento',
        }
      );
    case 'corregir':
      return corregirInterpretado(ctx, i, cuentas, frase);
    case 'anular': {
      const candidatos = buscarMovimientos(ctx, i.objetivo, frase.fecha);
      const [unico] = candidatos;
      if (!unico) return { resultado: 'no_encontrado', accion: 'anular' };
      if (aplicaDirecto(ctx, candidatos)) {
        return aplicarEleccion(ctx, { accion: 'anular', transaccionId: unico.id }, frase.origen);
      }
      return { resultado: 'elegir', accion: 'anular', candidatos };
    }
    case 'revisar_duplicados': {
      const grupos = buscarDuplicados(ctx, i.filtro, frase.fecha);
      return grupos.length > 0
        ? { resultado: 'duplicados', grupos }
        : { resultado: 'no_encontrado', accion: 'duplicados' };
    }
    case 'configurar':
      if (i.ajuste.tipo === 'tarjeta_ciclo') {
        const r = configurarCicloPorVoz(ctx, i.ajuste);
        return r.resultado === 'tarjeta_configurada' ? { ...r, deshacer: r.editada.deshacer } : r;
      }
      if (i.ajuste.tipo === 'tanda') {
        const propuesta = proponerTandaPorVoz(ctx, i.ajuste, frase.fecha);
        return propuesta
          ? { resultado: 'tanda_por_crear', propuesta }
          : { resultado: 'no_soportado', motivo: 'ajuste' };
      }
      if (i.ajuste.tipo !== 'compromiso') return { resultado: 'no_soportado', motivo: 'ajuste' };
      try {
        return { resultado: 'configurado', compromiso: configurarCompromiso(ctx, i.ajuste, frase.fecha) };
      } catch (error) {
        if (error instanceof ErrorDominio && error.codigo === 'espacio_no_disponible') {
          return { resultado: 'no_soportado', motivo: 'ajuste' };
        }
        throw error;
      }
    case 'consultar':
      // El modo explicar necesita red y varias vueltas: la pantalla lo resuelve con `explicar` (que revisa Plus).
      if (i.consulta.tipo === 'explicar') {
        return { resultado: 'explicar', pregunta: i.consulta.pregunta ?? frase.texto };
      }
      if (!tienePlantilla(i.consulta.tipo)) return { resultado: 'no_soportado', motivo: 'consulta' };
      // "Hoy puedes" es de Gratis; las demás consultas, de Plus (`01 §11`).
      if (i.consulta.tipo !== 'hoy_puedes' && !funcionesPlan(ctx).consultas)
        return { resultado: 'consulta', respuesta: respuestaSoloPlus(i.consulta.tipo) };
      return { resultado: 'consulta', respuesta: responderConsulta(ctx, i.consulta) };
    case 'aclarar':
      return {
        resultado: 'aclarar',
        motivo: i.motivo,
        pregunta: i.pregunta,
        opciones: i.opciones ?? [],
        texto: frase.texto,
      };
    case 'fuera_de_alcance':
      return { resultado: 'fuera_de_alcance', motivo: i.motivo ?? null };
    case 'gasto_compartido':
      return proponerGastoCompartido(ctx, i.gasto);
    case 'arqueo':
      return { resultado: 'arqueo', efectivoReal: i.efectivo_real };
    case 'simular': {
      const { precio, descripcion, meses, fecha } = i.compra;
      return {
        resultado: 'me_alcanza',
        consulta: {
          precio,
          ...(descripcion !== undefined ? { descripcion } : {}),
          ...(meses !== undefined ? { meses } : {}),
          ...(fecha !== undefined ? { fecha } : {}),
        },
      };
    }
  }
}

/** Nivel 0: solo lo que el teléfono ya sabe hacer sin la nube; `null` si hay que preguntarle a la nube. */
function nivelCero(ctx: Contexto, cuentas: readonly CuentaResolutor[], frase: Frase): ResultadoTexto | null {
  const i = interpretarReglas(frase.texto, contextoInterprete(ctx, cuentas, frase.fecha));
  if (i?.intencion === 'consultar' && tienePlantilla(i.consulta.tipo)) {
    return { resultado: 'consulta', respuesta: responderConsulta(ctx, i.consulta) };
  }
  if (i?.intencion === 'arqueo') return { resultado: 'arqueo', efectivoReal: i.efectivo_real };
  if (i?.intencion === 'gasto_compartido') return proponerGastoCompartido(ctx, i.gasto);
  if (i?.intencion !== 'registrar') return null;
  return registrarInterpretado(ctx, i.movimientos, cuentas, frase);
}

/**
 * Solo el nivel 0, síncrono (sin esperar a la red): lo que el teléfono resuelve al instante. `null` si la frase
 * necesita la nube; entonces la pantalla llama `registrarTexto`.
 */
export function registrarTextoLocal(
  ctx: Contexto,
  texto: string,
  origen: OrigenDictado = 'texto',
): ResultadoTexto | null {
  exigirConsentimiento(ctx);
  return nivelCero(ctx, cuentasResolutor(ctx), { texto, origen, fecha: ctx.reloj.hoy() });
}

export interface OpcionesTexto {
  /** Nivel 2; `null` o ausente: sin nube (todo lo que no cubre el nivel 0 queda "por interpretar"). */
  readonly nube?: NivelNube | null;
}

/**
 * Registro por voz o texto (`03 §5.1`, `06 §2`): nivel 0 → (null) → nivel 2 con red → validación Zod →
 * resolutor → política de confirmación → servicios. Sin red, sin nube o si la nube falla, la frase queda "por
 * interpretar" (RF-REG-07). Nunca registra el texto en logs (regla 9).
 */
export async function registrarTexto(
  ctx: Contexto,
  texto: string,
  origen: OrigenDictado = 'texto',
  opciones: OpcionesTexto = {},
): Promise<ResultadoTexto> {
  exigirConsentimiento(ctx);
  const frase: Frase = { texto, origen, fecha: ctx.reloj.hoy() };
  const cuentas = cuentasResolutor(ctx);
  const local = nivelCero(ctx, cuentas, frase);
  if (local) return local;
  const r = await interpretarEnNube(ctx, frase, opciones.nube ?? null);
  if (r.tipo !== 'ok') {
    if (r.tipo === 'invalida') return noEntendi(r);
    return {
      resultado: 'por_interpretar',
      id: guardarPorInterpretar(ctx, frase),
      motivo: r.tipo,
      ...(r.tipo === 'limite' ? { limite: r.codigo } : {}),
    };
  }
  return aplicarInterpretacion(ctx, r.interpretacion, cuentasResolutor(ctx), frase);
}

/** `invalida`: la nube no puede con esta frase (respuesta inválida, texto largo o rechazo definitivo del proxy). */
type RespuestaNube =
  | { tipo: 'ok'; interpretacion: Interpretacion }
  | { tipo: 'invalida'; motivo?: 'texto_largo' }
  | { tipo: 'limite'; codigo: CodigoLimite }
  | { tipo: Exclude<MotivoPorInterpretar, 'limite'> };

function noEntendi(r: Extract<RespuestaNube, { tipo: 'invalida' }>): ResultadoTexto {
  return { resultado: 'no_entendi', ...(r.motivo ? { motivo: r.motivo } : {}) };
}

/**
 * El proxy rechazó esta frase en particular (400 por el contrato, 413 o 422): reintentarla no sirve. Un 401,
 * 408, 429 o 5xx es pasajero y deja la frase esperando.
 */
function rechazoDefinitivo(r: Extract<ResultadoNube, { tipo: 'error' }>): boolean {
  return r.codigo === 'peticion_invalida' || r.status === 413 || r.status === 422;
}

async function interpretarEnNube(
  ctx: Contexto,
  frase: Frase,
  nube: NivelNube | null,
): Promise<RespuestaNube> {
  if (frase.texto.trim() === '') return { tipo: 'invalida' };
  if (frase.texto.length > TEXTO_MAXIMO_NUBE) return { tipo: 'invalida', motivo: 'texto_largo' };
  if (!nube) return { tipo: 'sin_nube' };
  try {
    if (!(await nube.conectividad.enLinea())) return { tipo: 'sin_red' };
  } catch {
    return { tipo: 'sin_red' };
  }
  const r = await nube.cliente.interpretar(frase.texto, contextoNube(ctx, frase.fecha));
  switch (r.tipo) {
    case 'ok':
      return { tipo: 'ok', interpretacion: r.interpretacion };
    case 'sin_red':
      return { tipo: 'sin_red' };
    case 'limite':
      return { tipo: 'limite', codigo: r.codigo };
    case 'error':
      return r.codigo === 'respuesta_invalida' || rechazoDefinitivo(r)
        ? { tipo: 'invalida' }
        : { tipo: 'error' };
  }
}

/**
 * "Guardar" de la tarjeta de confirmación: registra todos los movimientos en una transacción SQLite. Las cuentas
 * elegidas para un alias que no se reconoció se aprenden (`06 §12`).
 */
export function confirmarRegistro(
  ctx: Contexto,
  entradas: readonly EntradaMovimiento[],
  origen: OrigenDictado,
  opciones: {
    aprender?: readonly { alias: string; cuentaId: string }[];
    /** Hace idempotente el registro: la clave de cada movimiento es `<claveBase>:<i>`. */
    claveBase?: string;
  } = {},
): Extract<ResultadoTexto, { resultado: 'registrado' }> {
  exigirConsentimiento(ctx);
  if (entradas.length === 0) throw new ErrorDominio('movimiento_invalido', 'no hay nada que registrar');
  return enTransaccion(ctx, () => {
    const movimientos = entradas.map((e, i) =>
      resumir(
        ctx,
        registrarMovimiento(ctx, e, {
          origen,
          ...(opciones.claveBase ? { claveIdempotencia: `${opciones.claveBase}:${i}` } : {}),
        }),
        e,
      ),
    );
    for (const a of opciones.aprender ?? []) aprenderAlias(ctx, a.alias, a.cuentaId);
    return {
      resultado: 'registrado',
      deshacer: movimientos.map((m) => m.transaccionId).join(','),
      movimientos,
    };
  });
}

// ——— Por interpretar ———

const PorInterpretar = z.strictObject({
  texto: z.string(),
  origen: z.enum(['voz', 'texto']),
  fecha: z.string(),
  recibido_en: z.int(),
  /** `revisar`: la nube ya la interpretó pero necesita a la persona (confirmar, elegir, aclarar). */
  estado: z.enum(['pendiente', 'revisar']).optional(),
});

export interface FrasePorInterpretar {
  readonly id: string;
  readonly texto: string;
  readonly origen: OrigenDictado;
  readonly fecha: PlainDate;
  readonly recibidoEn: number;
  readonly estado: 'pendiente' | 'revisar';
}

const PREFIJO = 'por_interpretar:';

function guardarPorInterpretar(ctx: Contexto, frase: Frase): string {
  const id = ctx.generarId();
  escribirAjuste(ctx, `${PREFIJO}${id}`, PorInterpretar, {
    texto: frase.texto,
    origen: frase.origen,
    fecha: frase.fecha,
    recibido_en: ctx.reloj.ahora(),
  });
  return id;
}

/** "Por revisar": frases guardadas, en el orden en que se dijeron. */
export function listarPorInterpretar(ctx: Contexto): FrasePorInterpretar[] {
  return listarAjustes(ctx, PREFIJO, PorInterpretar)
    .map(({ clave, valor }) => ({
      id: clave.slice(PREFIJO.length),
      texto: valor.texto,
      origen: valor.origen,
      fecha: valor.fecha,
      recibidoEn: valor.recibido_en,
      estado: valor.estado ?? 'pendiente',
    }))
    .sort((a, b) => a.recibidoEn - b.recibidoEn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Frases guardadas (pendientes de red y por revisar). */
export function contarPorInterpretar(ctx: Contexto): number {
  return listarAjustes(ctx, PREFIJO, PorInterpretar).length;
}

/** Frases que esperan conexión (el indicador discreto del panel). */
export function contarEsperandoConexion(ctx: Contexto): number {
  return listarPorInterpretar(ctx).filter((f) => f.estado === 'pendiente').length;
}

/** Quita una frase de "Por revisar" (ya se registró a mano, ya se revisó o ya no aplica). */
export function descartarPorInterpretar(ctx: Contexto, id: string): void {
  exigirConsentimiento(ctx);
  borrarAjuste(ctx, `${PREFIJO}${id}`);
}

/**
 * "Revisar" una frase de "Por revisar": la vuelve a interpretar con la fecha en que se dijo. Si el resultado ya
 * quedó aplicado, la quita de la lista; si necesita a la persona (confirmar, elegir, aclarar), la pantalla la
 * descarta al terminar. Sin red o si la nube falla, se queda donde estaba (`por_interpretar` con su mismo id).
 */
export async function revisarPorInterpretar(
  ctx: Contexto,
  id: string,
  nube: NivelNube | null,
): Promise<ResultadoTexto | null> {
  exigirConsentimiento(ctx);
  const clave = `${PREFIJO}${id}`;
  const guardada = leerAjuste(ctx, clave, PorInterpretar);
  if (!guardada) return null;
  const frase: Frase = { texto: guardada.texto, origen: guardada.origen, fecha: guardada.fecha, fraseId: id };
  let r = nivelCero(ctx, cuentasResolutor(ctx), frase);
  if (!r) {
    const n = await interpretarEnNube(ctx, frase, nube);
    if (n.tipo === 'invalida') r = noEntendi(n);
    else if (n.tipo === 'ok') r = aplicarInterpretacion(ctx, n.interpretacion, cuentasResolutor(ctx), frase);
    else
      return {
        resultado: 'por_interpretar',
        id,
        motivo: n.tipo,
        ...(n.tipo === 'limite' ? { limite: n.codigo } : {}),
      };
  }
  if (AUTOMATICOS.has(r.resultado)) borrarAjuste(ctx, clave);
  return r;
}

const procesando = new WeakMap<Contexto, Promise<ResultadoCola>>();

export interface ResultadoCola {
  /** Frases que ya quedaron registradas, corregidas, anuladas o configuradas. */
  readonly aplicadas: number;
  /** Frases que la nube entendió pero necesitan a la persona: quedan en "Por revisar". */
  readonly porRevisar: number;
  /** Frases que siguen esperando (sin red, límite o error del proxy). */
  readonly pendientes: number;
}

/**
 * CA-M3-05: al reconectar interpreta las frases guardadas **en orden**, una por una, con la fecha en que se
 * dijeron. Idempotente: cada frase se aplica y se borra de la cola en la misma transacción SQLite (y sus
 * movimientos llevan clave `frase:<id>:<i>`), y dos llamadas simultáneas comparten la misma corrida. Se detiene
 * en el primer fallo pasajero (red, límite, 5xx, tiempo) para no saltarse el orden; una frase que la nube no puede
 * interpretar (rechazo definitivo, texto largo, respuesta inválida) va a "Por revisar" y la cola sigue. Anular y
 * corregir nunca se aplican desde aquí: van a "Por revisar" para que la persona vea el cambio.
 */
export function procesarPorInterpretar(ctx: Contexto, nube: NivelNube | null): Promise<ResultadoCola> {
  const enCurso = procesando.get(ctx);
  if (enCurso) return enCurso;
  const corrida = (async (): Promise<ResultadoCola> => {
    let aplicadas = 0;
    let porRevisar = 0;
    const cola = listarPorInterpretar(ctx).filter((f) => f.estado === 'pendiente');
    let i = 0;
    for (; i < cola.length; i++) {
      const f = cola[i] as FrasePorInterpretar;
      const frase: Frase = { texto: f.texto, origen: f.origen, fecha: f.fecha, fraseId: f.id };
      const r = await interpretarEnNube(ctx, frase, nube);
      if (r.tipo !== 'ok' && r.tipo !== 'invalida') break;
      const clave = `${PREFIJO}${f.id}`;
      const marcarRevisar = () => {
        escribirAjuste(ctx, clave, PorInterpretar, {
          texto: f.texto,
          origen: f.origen,
          fecha: f.fecha,
          recibido_en: f.recibidoEn,
          estado: 'revisar',
        });
        return 'revisar' as const;
      };
      let final: 'ya' | 'aplicada' | 'revisar';
      try {
        final = enTransaccion(ctx, () => {
          if (!leerAjuste(ctx, clave, PorInterpretar)) return 'ya' as const; // otra corrida ya la aplicó
          if (r.tipo === 'ok' && SOLO_CON_LA_PERSONA.has(r.interpretacion.intencion)) return marcarRevisar();
          const res =
            r.tipo === 'ok'
              ? aplicarInterpretacion(ctx, r.interpretacion, cuentasResolutor(ctx), frase)
              : ({ resultado: 'no_entendi' } as const);
          if (!AUTOMATICOS.has(res.resultado)) return marcarRevisar();
          borrarAjuste(ctx, clave);
          return 'aplicada' as const;
        });
      } catch (error) {
        // Un error de dominio (cuenta archivada, patrón inválido) no detiene la cola: la frase va a revisión.
        if (!(error instanceof ErrorDominio)) throw error;
        final = marcarRevisar();
      }
      if (final === 'aplicada') aplicadas++;
      if (final === 'revisar') porRevisar++;
    }
    return { aplicadas, porRevisar, pendientes: cola.length - i };
  })();
  procesando.set(ctx, corrida);
  return corrida.finally(() => procesando.delete(ctx));
}
