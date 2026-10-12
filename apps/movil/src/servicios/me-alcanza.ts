import { z } from 'zod';
import {
  crearComparacion,
  ErrorDominio,
  esFecha,
  estadoDatos,
  expandirProgramados,
  generarEscenarios,
  planMsi,
  redondearPorcentaje,
  semillaDelDia,
  sumarDias,
  sumarMeses,
  type Centavos,
  type CompromisoFechado,
  type EntradaComparacion,
  type Escenario,
  type EscenarioCompra,
  type EscenariosGenerados,
  type NotaEscenarios,
  type PlainDate,
  type ResultadoComparacion,
  type TarjetaCredito,
  type TarjetaRecomendable,
} from '@cartera/core';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { procesarApertura } from './apertura';
import { ejecutarPorBloques, type OpcionesBloques } from './bloques';
import type { Contexto } from './contexto';
import { diaLargo, etiquetaDiaMes, etiquetaFecha, mesLargo, miles, pesos } from './formato';
import { registrarMovimiento } from './formulario';
import { historialSimulacion } from './historial';
import { calcularLibre } from './hoy';
import { registrarCompraMsi, type CompraMsiRegistrada } from './msi';
import { listarOcurrencias } from './ocurrencias';
import { programadosActivos } from './programados';
import { ETIQUETA_ESTIMACION_INICIAL, MENSAJE_DATOS_INSUFICIENTES } from './probabilidad';
import { cuotasMsiPendientes, msiPorPagar, tarjetasActivas } from './tarjetas';

/** Lo que pregunta la persona ("¿me alcanza para unos tenis de 1,500?"; intención `simular` de `06 §3`). */
export const ConsultaMeAlcanza = z.strictObject({
  precio: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  descripcion: z.string().trim().min(1).max(200).optional(),
  /** Meses que pidió (2–48). */
  meses: z.int().min(2).max(48).optional(),
  /** Fecha en que piensa comprar ("el viernes"): escenario "esperar". */
  fecha: z.string().refine(esFecha, 'fecha inválida').optional(),
});
export type ConsultaMeAlcanza = z.infer<typeof ConsultaMeAlcanza>;

/** Copy de las notas (`02 §9`). */
export const TEXTO_SIN_TARJETA_PARA_MSI =
  'No muestro meses: ninguna de tus tarjetas que pagas completa tiene crédito disponible para esta compra.';

export type NivelRecomendacion = 'puedes' | 'ajustado' | 'no_alcanza';

export interface VistaEscenarioMeAlcanza {
  /** Clave estable para la lista ("base", "contado_hoy", "esperar:2026-10-15", "msi:3:<tarjeta>"). */
  readonly clave: string;
  readonly tipo: Escenario['tipo'];
  /** "Hoy, de contado", "A 3 MSI con la Oro", "El jue 15, con tu quincena", "Sin comprarlos". */
  readonly etiqueta: string;
  /** "< 1 %", "89 %". */
  readonly porcentaje: string;
  readonly probabilidad: number;
  readonly exitos: number;
  /** "Te quedas corto antes del jueves", "Comprometes $500 al mes hasta enero"…; `null` en "sin comprar". */
  readonly detalle: string | null;
  readonly recomendado: boolean;
  /** Algún cargo cae después del tope de 24 meses (no se evaluó completo). */
  readonly parcial: boolean;
  /** Lo que se pasa a `loCompre`. */
  readonly escenario: Escenario;
}

export interface ComoLoCalcule {
  readonly desde: PlainDate;
  /** Fin exclusivo de la ventana evaluada (todas las opciones). */
  readonly hasta: PlainDate;
  readonly diasVentana: number;
  /** Simulaciones por opción. */
  readonly simulaciones: number;
  readonly diasHistorial: number;
  /** Primer día del historial usado (para "ver los movimientos"). */
  readonly historialDesde: PlainDate | null;
  /** Dinero libre de hoy (E4), punto de partida de "sin comprar". */
  readonly excedenteInicial: Centavos;
  readonly ingresos: readonly { readonly fecha: PlainDate; readonly monto: Centavos }[];
  readonly compromisos: readonly {
    readonly desde: PlainDate;
    readonly hasta: PlainDate;
    readonly monto: Centavos;
  }[];
  /** Párrafo listo para mostrar, una línea por idea. */
  readonly lineas: readonly string[];
}

export type VistaMeAlcanza =
  | {
      readonly estado: 'datos_insuficientes';
      readonly titulo: string;
      readonly diasHistorial: number;
      readonly mensaje: string;
    }
  | {
      readonly estado: 'ok';
      /** "Unos tenis de $1,500". */
      readonly titulo: string;
      readonly consulta: ConsultaMeAlcanza;
      /** "Puedes. Lo más seguro: a 3 MSI con la Oro". */
      readonly frase: string;
      /** "Puedes. Lo más seguro: a 3 MSI con la Oro (89 %)". */
      readonly fraseCompleta: string;
      readonly nivel: NivelRecomendacion;
      readonly recomendado: VistaEscenarioMeAlcanza;
      /** Orden de `02 §9`: contado, meses, esperar y al final "sin comprar". */
      readonly escenarios: readonly VistaEscenarioMeAlcanza[];
      readonly notas: readonly { readonly tipo: NotaEscenarios; readonly texto: string }[];
      /** "estimación inicial" con 14–41 días de historial. */
      readonly etiqueta: string | null;
      readonly comoLoCalcule: ComoLoCalcule;
      /** "Recuérdamelo el jueves" (si hay escenario "esperar"). */
      readonly recordatorio: { readonly fecha: PlainDate; readonly texto: string } | null;
    };

/** Todo lo que necesita la vista además del resultado del motor (para inyectar E8-22 en pruebas). */
export interface DatosVistaMeAlcanza {
  readonly consulta: ConsultaMeAlcanza;
  readonly hoy: PlainDate;
  readonly proximoIngreso: { readonly fecha: PlainDate; readonly concepto: string } | null;
  readonly tarjetas: readonly {
    readonly id: string;
    readonly nombre: string;
    readonly ciclo: TarjetaCredito;
  }[];
  readonly generados: Pick<EscenariosGenerados, 'nota' | 'uso_bp'>;
  readonly resultado: Extract<ResultadoComparacion, { estado: 'ok' }>;
  readonly diasHistorial: number;
  readonly historialDesde: PlainDate | null;
}

// ——— Textos ———

/** "Banamex Oro ••8812" → "la Oro"; "Nu ••4410" → "la Nu" (sin terminación ni banco). */
export function nombreCortoTarjeta(nombre: string): string {
  const palabras = nombre
    .replace(/\s*[•·*]+\s*\d{2,4}\s*$/u, '')
    .trim()
    .split(/\s+/)
    .filter((p) => p !== '');
  const corto = palabras.length > 1 ? palabras.slice(1).join(' ') : (palabras[0] ?? nombre);
  return `la ${corto}`;
}

const mayuscula = (s: string) => (s === '' ? s : `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`);
const minuscula = (s: string) => (s === '' ? s : `${s[0]?.toLowerCase() ?? ''}${s.slice(1)}`);

/** "Unos tenis de $1,500"; sin descripción, "Una compra de $1,500". */
export function tituloConsulta(c: ConsultaMeAlcanza): string {
  return `${mayuscula(c.descripcion ?? 'una compra')} de ${pesos(c.precio)}`;
}

/** "Sin comprarlos" / "Sin comprarla" / "Sin comprarlo" según el artículo de la descripción. */
function sinComprar(descripcion: string | undefined): string {
  if (!descripcion) return 'Sin comprar';
  const primera = descripcion.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const pronombre =
    primera === 'unos' || primera === 'los'
      ? 'los'
      : primera === 'unas' || primera === 'las'
        ? 'las'
        : primera === 'una' || primera === 'la'
          ? 'la'
          : 'lo';
  return `Sin comprar${pronombre}`;
}

function nivelDe(porcentaje: number): NivelRecomendacion {
  return porcentaje >= 80 ? 'puedes' : porcentaje >= 50 ? 'ajustado' : 'no_alcanza';
}

const ENTRADA_FRASE: Record<NivelRecomendacion, string> = {
  puedes: 'Puedes. Lo más seguro:',
  ajustado: 'Es posible, pero ajustado. Lo más seguro:',
  no_alcanza: 'No te alcanza sin tocar tu colchón. La opción menos riesgosa:',
};

function claveEscenario(e: Escenario): string {
  switch (e.tipo) {
    case 'base':
    case 'contado_hoy':
      return e.tipo;
    case 'esperar':
      return `esperar:${e.fecha}`;
    case 'msi':
      return `msi:${e.meses}:${e.tarjeta}`;
  }
}

const ORDEN_VISTA: Record<Escenario['tipo'], number> = { contado_hoy: 0, msi: 1, esperar: 2, base: 3 };

/**
 * Vista de "¿Me alcanza?" (`02 §9`) a partir del resultado del motor (E8.5): etiquetas, porcentajes, notas,
 * recomendación y "cómo lo calculé". Pura: ninguna cifra se calcula aquí, solo se redacta (regla 4).
 */
export function construirVistaMeAlcanza(d: DatosVistaMeAlcanza): Extract<VistaMeAlcanza, { estado: 'ok' }> {
  const { consulta, hoy, proximoIngreso, resultado } = d;
  const tarjetas = new Map(d.tarjetas.map((t) => [t.id, t]));
  const n = resultado.n;
  const recomendadoClave = claveEscenario(resultado.recomendado);
  const compras = resultado.resultados.filter((r) => r.escenario.tipo !== 'base');
  const mejor = Math.max(...compras.map((r) => r.exitos));
  const nivel = nivelDe(redondearPorcentaje(mejor, n));

  const etiquetaDe = (e: Escenario): string => {
    switch (e.tipo) {
      case 'base':
        return sinComprar(consulta.descripcion);
      case 'contado_hoy':
        return 'Hoy, de contado';
      case 'esperar':
        return proximoIngreso && e.fecha === proximoIngreso.fecha
          ? `El ${etiquetaFecha(e.fecha)}, con tu ${proximoIngreso.concepto}`
          : `El ${etiquetaFecha(e.fecha)}`;
      case 'msi': {
        const t = tarjetas.get(e.tarjeta);
        return `A ${e.meses} MSI con ${t ? nombreCortoTarjeta(t.nombre) : 'tu tarjeta'}`;
      }
    }
  };

  const detalleDe = (e: Escenario, exitos: number): string | null => {
    const nivelEscenario = nivelDe(redondearPorcentaje(exitos, n));
    switch (e.tipo) {
      case 'base':
        return null;
      case 'contado_hoy':
        if (nivelEscenario !== 'no_alcanza') return 'Lo pagas hoy, sin deuda nueva';
        return proximoIngreso
          ? `Te quedas corto antes del ${diaLargo(proximoIngreso.fecha)}`
          : 'Te quedas corto antes de tu próximo ingreso';
      case 'esperar':
        return proximoIngreso && e.fecha === proximoIngreso.fecha
          ? `Lo pagas con tu ${proximoIngreso.concepto}, sin deuda nueva`
          : `Esperas al ${etiquetaFecha(e.fecha)}, sin deuda nueva`;
      case 'msi': {
        const t = tarjetas.get(e.tarjeta);
        if (!t) return null;
        const cuotas = planMsi(e.precio, e.meses, hoy, t.ciclo);
        const ultima = cuotas[cuotas.length - 1];
        const cuota = Math.max(...cuotas.map((c) => c.monto));
        if (!ultima) return null;
        const mismoAnio = ultima.limite < sumarMeses(hoy, 12);
        const hasta = mismoAnio
          ? mesLargo(ultima.limite)
          : `${mesLargo(ultima.limite)} de ${ultima.limite.slice(0, 4)}`;
        return `Comprometes ${pesos(cuota)} al mes hasta ${hasta}`;
      }
    }
  };

  const escenarios: VistaEscenarioMeAlcanza[] = resultado.resultados
    .map((r) => ({
      clave: claveEscenario(r.escenario),
      tipo: r.escenario.tipo,
      etiqueta: etiquetaDe(r.escenario),
      porcentaje: r.porcentaje,
      probabilidad: r.probabilidad,
      exitos: r.exitos,
      detalle: detalleDe(r.escenario, r.exitos),
      recomendado: claveEscenario(r.escenario) === recomendadoClave,
      parcial: r.parcial,
      escenario: r.escenario,
    }))
    .map((v, i) => ({ v, i }))
    .sort((a, b) => ORDEN_VISTA[a.v.tipo] - ORDEN_VISTA[b.v.tipo] || a.i - b.i)
    .map(({ v }) => v);
  const recomendado = escenarios.find((e) => e.recomendado) as VistaEscenarioMeAlcanza;
  const frase = `${ENTRADA_FRASE[nivel]} ${minuscula(recomendado.etiqueta)}`;

  const notas: { tipo: NotaEscenarios; texto: string }[] = [];
  if (d.generados.nota === 'uso_alto') {
    const msi = resultado.resultados.find((r) => r.escenario.tipo === 'msi')?.escenario;
    const t = msi?.tipo === 'msi' ? tarjetas.get(msi.tarjeta) : undefined;
    const uso = redondearPorcentaje(d.generados.uso_bp ?? 0, 10000);
    notas.push({
      tipo: 'uso_alto',
      texto: `Con ${t ? nombreCortoTarjeta(t.nombre) : 'tu tarjeta'} quedarías en ${uso} % de uso.`,
    });
  } else if (d.generados.nota === 'sin_tarjeta_para_msi') {
    notas.push({ tipo: 'sin_tarjeta_para_msi', texto: TEXTO_SIN_TARJETA_PARA_MSI });
  }

  const base = resultado.resultados.find((r) => r.escenario.tipo === 'base');
  const ingresos = resultado.horizontes.slice(1).map((h) => ({ fecha: h.inicio, monto: h.ingreso }));
  const compromisos = resultado.horizontes
    .slice(1)
    .filter((h) => h.compromisos > 0)
    .map((h) => ({ desde: h.inicio, hasta: h.fin, monto: h.compromisos }));
  const totalCompromisos = compromisos.reduce((s, c) => s + c.monto, 0);
  const ultimoDia = sumarDias(resultado.ventana_hasta, -1);
  const lineas = [
    `Revisé ${resultado.dias_ventana} días, del ${etiquetaDiaMes(hoy)} al ${etiquetaDiaMes(ultimoDia)}, para que todas las opciones incluyan sus pagos.`,
    `Hice ${miles(n)} simulaciones por opción con tus últimos ${d.diasHistorial} días de gastos.`,
    ingresos.length > 0
      ? `Supuse ${ingresos.length === 1 ? '1 ingreso' : `${ingresos.length} ingresos`} de ${pesos(ingresos[0]?.monto ?? 0)} y ${pesos(totalCompromisos)} en pagos fijos, tarjetas y meses.`
      : 'No supuse ingresos nuevos en este periodo.',
    'Todas las opciones usan los mismos días simulados: la diferencia se debe solo a la compra.',
  ];

  const esperar = resultado.resultados.find((r) => r.escenario.tipo === 'esperar')?.escenario;
  return {
    estado: 'ok',
    titulo: tituloConsulta(consulta),
    consulta,
    frase,
    fraseCompleta: `${frase} (${recomendado.porcentaje})`,
    nivel,
    recomendado,
    escenarios,
    notas,
    etiqueta: estadoDatos(d.diasHistorial) === 'estimacion_inicial' ? ETIQUETA_ESTIMACION_INICIAL : null,
    comoLoCalcule: {
      desde: hoy,
      hasta: resultado.ventana_hasta,
      diasVentana: resultado.dias_ventana,
      simulaciones: n,
      diasHistorial: d.diasHistorial,
      historialDesde: d.historialDesde,
      excedenteInicial: base?.excedente_inicial ?? 0,
      ingresos,
      compromisos,
      lineas,
    },
    recordatorio:
      esperar?.tipo === 'esperar'
        ? { fecha: esperar.fecha, texto: `Recuérdamelo el ${diaLargo(esperar.fecha)}` }
        : null,
  };
}

// ——— Preparación sobre el libro ———

export type PreparacionMeAlcanza =
  | {
      readonly estado: 'datos_insuficientes';
      readonly diasHistorial: number;
      readonly consulta: ConsultaMeAlcanza;
    }
  | {
      readonly estado: 'listo';
      readonly entrada: EntradaComparacion;
      readonly datos: Omit<DatosVistaMeAlcanza, 'resultado'>;
    };

function validarConsulta(consulta: ConsultaMeAlcanza): ConsultaMeAlcanza {
  const r = ConsultaMeAlcanza.safeParse(consulta);
  if (!r.success) throw new ErrorDominio('consulta_invalida', 'revisa el precio, los meses o la fecha');
  return r.data;
}

/**
 * Compromisos de los horizontes futuros (E8.3, `k ≥ 1`): egresos programados activos (incluidos los pagos
 * planeados de tarjetas en plan) dentro de su vigencia y sin las ocurrencias ya cubiertas u omitidas, y las
 * cuotas MSI no facturadas en su fecha límite. Los que caen en H₀ ya están en `E₀` y el motor los ignora.
 */
function compromisosFuturos(ctx: Contexto, hoy: PlainDate): CompromisoFechado[] {
  const hasta = sumarDias(sumarMeses(hoy, 24), 62);
  const resueltas = new Set(
    listarOcurrencias(ctx, { tipo: 'egreso' })
      .filter((o) => o.estado !== 'pendiente')
      .map((o) => `${o.programadoId}|${o.fecha}`),
  );
  const salida: CompromisoFechado[] = [];
  for (const p of programadosActivos(ctx)) {
    if (p.tipo !== 'egreso') continue;
    for (const o of expandirProgramados([p], hoy, hasta)) {
      if (o.fecha < p.desde || (p.hasta !== null && o.fecha > p.hasta)) continue;
      if (resueltas.has(`${p.id}|${o.fecha}`)) continue;
      salida.push({ fecha: o.fecha, monto: o.monto });
    }
  }
  for (const c of cuotasMsiPendientes(ctx)) salida.push({ fecha: c.limite, monto: c.monto });
  return salida;
}

/** Arma la entrada de E8.5 sobre el libro (sin escribir nada). */
export function prepararMeAlcanza(ctx: Contexto, consulta: ConsultaMeAlcanza): PreparacionMeAlcanza {
  const c = validarConsulta(consulta);
  const calculo = calcularLibre(ctx);
  const { hoy, ingreso, h, r } = calculo;
  const hist = historialSimulacion(ctx, hoy);
  const diasHistorial = hist.historial.length;
  if (estadoDatos(diasHistorial) === 'datos_insuficientes') {
    return { estado: 'datos_insuficientes', diasHistorial, consulta: c };
  }
  const conIngreso = ingreso !== null && h.estado !== 'ingreso_variable';
  const proximoIngreso = conIngreso ? { fecha: h.fin, concepto: ingreso.concepto } : null;
  const leidas = tarjetasActivas(ctx);
  const recomendables: TarjetaRecomendable[] = leidas.map((t) => ({
    id: t.cuentaId,
    ...t.ciclo,
    modo: t.modo,
    limiteCredito: t.limiteCredito,
    saldoRevolvente: t.saldoRevolvente,
    msiNoFacturado: msiPorPagar(ctx, t.cuentaId),
  }));
  const generados = generarEscenarios(
    c.precio,
    hoy,
    proximoIngreso && proximoIngreso.fecha > hoy ? proximoIngreso.fecha : null,
    recomendables,
    c.meses,
    c.fecha,
  );
  const entrada: EntradaComparacion = {
    hoy,
    excedente_inicial: r.libre,
    regla_ingreso: conIngreso ? ingreso.regla : null,
    monto_ingreso: conIngreso ? ingreso.monto : 0,
    programados: [],
    recibidas: calculo.recibidas,
    tarjetas: leidas.map((t) => ({ id: t.cuentaId, ...t.ciclo })),
    historial: hist.historial,
    escenarios: generados.escenarios,
    semilla: semillaDelDia(hoy),
    compromisos_fechados: compromisosFuturos(ctx, hoy),
    ...(hist.hoyEsDiaDePago ? { hoy_es_dia_de_pago: true } : {}),
  };
  return {
    estado: 'listo',
    entrada,
    datos: {
      consulta: c,
      hoy,
      proximoIngreso,
      tarjetas: leidas.map((t) => ({ id: t.cuentaId, nombre: t.nombre, ciclo: t.ciclo })),
      generados: { nota: generados.nota, uso_bp: generados.uso_bp },
      diasHistorial,
      historialDesde: hist.historial[0]?.fecha ?? null,
    },
  };
}

/**
 * "¿Me alcanza?" (RF-SIM-01, `03 §5.4`): `generarEscenarios` + `construirHorizontes` + `compararEscenarios` por
 * bloques (indicador de progreso con `alProgreso`), todo con la semilla del día. Devuelve la vista de `02 §9`.
 */
export async function meAlcanza(
  ctx: Contexto,
  consulta: ConsultaMeAlcanza,
  opciones: OpcionesBloques = {},
): Promise<VistaMeAlcanza> {
  procesarApertura(ctx);
  const p = prepararMeAlcanza(ctx, consulta);
  if (p.estado === 'datos_insuficientes') {
    return {
      estado: 'datos_insuficientes',
      titulo: tituloConsulta(p.consulta),
      diasHistorial: p.diasHistorial,
      mensaje: MENSAJE_DATOS_INSUFICIENTES,
    };
  }
  const resultado = await ejecutarPorBloques(crearComparacion(p.entrada), opciones);
  if (resultado.estado !== 'ok') {
    return {
      estado: 'datos_insuficientes',
      titulo: tituloConsulta(p.datos.consulta),
      diasHistorial: p.datos.diasHistorial,
      mensaje: MENSAJE_DATOS_INSUFICIENTES,
    };
  }
  return construirVistaMeAlcanza({ ...p.datos, resultado });
}

// ——— "Lo compré" ———

export interface CompraElegida {
  readonly escenario: EscenarioCompra;
  readonly descripcion?: string;
}

export interface OpcionesLoCompre {
  /** De dónde salió el dinero (contado / esperar). Sin ella: "por asignar" (`06 §5`). */
  readonly origenId?: string;
  /** Categoría (slug); por omisión `otros_gastos`. */
  readonly categoria?: string;
}

export type ResultadoLoCompre =
  | { readonly tipo: 'gasto'; readonly transaccionId: string; readonly deshacer: string }
  | { readonly tipo: 'msi'; readonly compra: CompraMsiRegistrada; readonly deshacer: string };

/**
 * "Lo compré" (`02 §9`): registra la compra con la opción elegida usando los servicios de siempre. De contado
 * (o al esperar, cuando ya la hiciste) es un gasto de hoy; a meses crea la compra MSI con su plan (E6).
 */
export function loCompre(
  ctx: Contexto,
  compra: CompraElegida,
  opciones: OpcionesLoCompre = {},
): ResultadoLoCompre {
  exigirConsentimiento(ctx);
  const e = compra.escenario as Escenario;
  const descripcion = compra.descripcion?.trim() ? compra.descripcion.trim() : undefined;
  const categoria = opciones.categoria ?? 'otros_gastos';
  switch (e.tipo) {
    case 'base':
      throw new ErrorDominio('escenario_invalido', '"sin comprar" no registra nada');
    case 'contado_hoy':
    case 'esperar': {
      const r = registrarMovimiento(ctx, {
        tipo: 'gasto',
        monto: e.precio,
        fecha: ctx.reloj.hoy(),
        categoria,
        origenId: opciones.origenId ?? CUENTAS_SISTEMA.porAsignar,
        ...(descripcion ? { descripcion } : {}),
      });
      return { tipo: 'gasto', transaccionId: r.transaccionId, deshacer: r.deshacer };
    }
    case 'msi': {
      const r = registrarCompraMsi(ctx, {
        tarjetaId: e.tarjeta,
        monto: e.precio,
        meses: e.meses,
        fecha: ctx.reloj.hoy(),
        categoria,
        ...(descripcion ? { descripcion } : {}),
      });
      return { tipo: 'msi', compra: r, deshacer: r.deshacer };
    }
  }
}
