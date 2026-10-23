import type { Centavos, DiaSemana, PlainDate, Regla } from '@cartera/core';
import type { LecturaDe, LecturaPaso } from '@cartera/nlu';
import type { EntradaCuenta, EntradaTarjeta, TarjetaPorAgregar } from '../../servicios';
import { etiquetaFecha } from '../../servicios/formato';
import type { FilaEntendi, PropuestaEntendi } from '../../ui/entendi';
import { formatearCentavos } from '../../ui/formato';
import { OPCIONES_DIA_SEMANA, reglaDeIngreso, type FinDeSemana, type Frecuencia } from './ingreso';
import { prellenadoDePagoLeido, type PagoPrellenado } from '../pagos-fijos/prellenado';
import { describirRegla, reglaDePago } from './pagos-fijos';
import {
  ETIQUETA_DIA_MES_INGRESO,
  ETIQUETA_DIA_SEMANA_INGRESO,
  ETIQUETA_PROXIMA_VEZ_INGRESO,
  ETIQUETA_PROXIMO_PAGO,
  ETIQUETAS_SUBTIPO_CUENTA,
  FALTA_DATO,
  FILA_CADA_CUANDO,
  FILA_CADA_VEZ,
  FILA_FIN_DE_SEMANA,
  FILAS_TARJETA,
  FALTANTES_INGRESO,
  FALTANTES_PAGO,
  FALTANTES_PAGO_FRASE,
  FALTANTES_TARJETA,
  TEXTO_EFECTIVO_YA_ESTA,
  textoYaEstanEnLista,
} from './textos';

/**
 * «Dímelo» de cada paso del onboarding (Ola 7 §7): lo que leyó `interpretarPaso` se vuelve la tarjeta «Entendí» y,
 * al decir «Sí», lo que se guarda o lo que llena el formulario. Solo mapeo y texto: las fechas salen de
 * `servicios` y las cifras ya vienen en centavos del intérprete (regla 4). Sin React ni `react-native` para que se
 * pruebe en Node.
 */

type LecturaIngreso = LecturaDe<'ingreso'>;
type LecturaCuentas = LecturaDe<'cuentas'>;
type LecturaTarjeta = LecturaDe<'tarjeta'>;
export type CuentaLeida = LecturaCuentas['cuentas'][number];
export type PagoLeido = LecturaDe<'pagos_fijos'>['pagos'][number];

/** `$13,000` y, si se dijo «como», la marca. */
export function cifraDicha(monto: Centavos, aproximado: boolean): string {
  const texto = formatearCentavos(monto);
  return aproximado ? `${texto} · aproximado` : texto;
}

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * La tarjeta en una frase para el lector de pantalla: título, cifra y filas (`etiquetaHablada` la pasa a palabras).
 * Nunca va a logs.
 */
export function resumenEntendi(p: PropuestaEntendi): string {
  return [
    p.titulo,
    p.monto === undefined ? null : formatearCentavos(p.monto),
    ...p.filas.map((f) => `${f.etiqueta}: ${f.valor}`),
    p.efecto ?? null,
  ]
    .filter((x): x is string => x !== null && x !== '')
    .join('. ');
}

// ——— Correcciones: «no, son 12 mil» encima de lo que ya se entendió ———

/**
 * Junta una corrección dicha con la tarjeta que ya estaba (`06 §13`): lo nuevo gana; en cuentas y pagos, lo que se
 * nombra igual se reemplaza y lo demás se agrega. Si la corrección es de otro paso, es una lectura nueva. `null` si
 * juntas ya no caben (más de 6 cuentas o 5 pagos): la persona lo dice otra vez.
 */
export function combinarLecturas(anterior: LecturaPaso, nueva: LecturaPaso): LecturaPaso | null {
  if (anterior.paso !== nueva.paso) return nueva;
  switch (nueva.paso) {
    case 'ingreso': {
      const a = anterior as LecturaIngreso;
      if (nueva.frecuencia === 'varia') return nueva;
      const frecuencia = nueva.frecuencia ?? (a.frecuencia === 'varia' ? undefined : a.frecuencia);
      const regla = nueva.frecuencia !== undefined ? nueva.regla : a.regla;
      const monto = nueva.monto ?? a.monto;
      const finDeSemana = nueva.finDeSemana ?? a.finDeSemana;
      return {
        paso: 'ingreso',
        ...(monto ? { monto } : {}),
        ...(frecuencia ? { frecuencia } : {}),
        ...(regla ? { regla } : {}),
        ...(finDeSemana ? { finDeSemana } : {}),
      };
    }
    case 'cuentas': {
      const a = anterior as LecturaCuentas;
      const clave = (c: CuentaLeida) => normal(c.institucion ?? c.nombre);
      const cuentas = [...a.cuentas];
      for (const c of nueva.cuentas) {
        const i = cuentas.findIndex((x) => clave(x) === clave(c));
        if (i >= 0) cuentas[i] = c;
        else cuentas.push(c);
      }
      const efectivo = nueva.efectivo ?? a.efectivo;
      if (cuentas.length + (efectivo ? 1 : 0) > 6) return null;
      return { paso: 'cuentas', ...(efectivo ? { efectivo } : {}), cuentas };
    }
    case 'pagos_fijos': {
      const pagos = [...(anterior as LecturaDe<'pagos_fijos'>).pagos];
      for (const p of nueva.pagos) {
        const i = pagos.findIndex((x) => normal(x.concepto) === normal(p.concepto));
        const a = pagos[i];
        if (!a) {
          pagos.push(p);
          continue;
        }
        // «La renta son 5 mil»: cambia el monto y se queda el día; si se dijo otra frecuencia, el día viejo sobra.
        const { regla, avisos, ...resto } = { ...a, ...p };
        const otraFrecuencia = p.frecuencia !== undefined || p.regla !== undefined;
        pagos[i] = {
          ...resto,
          ...(regla && (!otraFrecuencia || p.regla) ? { regla } : {}),
          ...(avisos && !otraFrecuencia ? { avisos } : {}),
        };
      }
      return pagos.length > 5 ? null : { paso: 'pagos_fijos', pagos };
    }
    case 'tarjeta': {
      const a = { ...(anterior as LecturaTarjeta) };
      // Día límite o días para pagar, nunca los dos: el que se dijo al último gana.
      if (nueva.diaLimitePago !== undefined) delete a.diasParaPagar;
      if (nueva.diasParaPagar !== undefined) delete a.diaLimitePago;
      return { ...a, ...nueva };
    }
    case 'tanda':
      return { ...(anterior as LecturaDe<'tanda'>), ...nueva };
    case 'efectivo':
    case 'colchon':
      return nueva;
  }
}

// ——— O3 · Ingreso ———

/** Lo que muestra el formulario de O3 más lo dicho: es lo que se guarda con «Sí». */
export interface EstadoIngreso {
  frecuencia: Frecuencia;
  finDeSemana: FinDeSemana;
  diaSemana: DiaSemana | null;
  /** Próxima fecha de pago (cada 14 días). */
  ancla: PlainDate | null;
  diaMes: number | null;
  monto: Centavos | null;
  aproximado: boolean;
  /** «Los días 10 y 25»: una quincena que no es «15 y último» y que los chips no pueden mostrar. */
  reglaDicha: Regla | null;
}

const FIN_DE_SEMANA_DE_AJUSTE: Readonly<Record<string, FinDeSemana>> = {
  anterior: 'antes',
  siguiente: 'despues',
  ninguno: 'mismo',
};

/**
 * Pone lo dicho encima de lo que ya tenía el formulario: lo no dicho queda como estaba; si cambió la frecuencia,
 * el día de la anterior ya no aplica.
 */
export function ingresoConLectura(actual: EstadoIngreso, l: LecturaIngreso): EstadoIngreso {
  const frecuencia = l.frecuencia ?? actual.frecuencia;
  const misma = frecuencia === actual.frecuencia;
  const r = l.regla;
  const ajuste = r && 'ajuste' in r && r.ajuste ? FIN_DE_SEMANA_DE_AJUSTE[r.ajuste] : undefined;
  return {
    frecuencia,
    finDeSemana: l.finDeSemana ?? ajuste ?? actual.finDeSemana,
    diaSemana: r?.tipo === 'semanal' ? (r.dia_semana as DiaSemana) : misma ? actual.diaSemana : null,
    ancla: r?.tipo === 'catorcenal' ? r.ancla : misma ? actual.ancla : null,
    diaMes: r?.tipo === 'mensual' ? r.dia : misma ? actual.diaMes : null,
    monto: l.monto ? l.monto.monto : actual.monto,
    aproximado: l.monto ? l.monto.aproximado : actual.aproximado,
    reglaDicha: r?.tipo === 'quincenal_dias' ? (r as Regla) : misma ? actual.reglaDicha : null,
  };
}

const AJUSTE_DE_FIN_DE_SEMANA = { antes: 'anterior', despues: 'siguiente', mismo: 'ninguno' } as const;

/** La regla que se guardaría, o `null` si falta un dato (o es «Varía»). */
export function reglaDeEstadoIngreso(e: EstadoIngreso): Regla | null {
  if (e.frecuencia === 'quincena' && e.reglaDicha?.tipo === 'quincenal_dias') {
    return { ...e.reglaDicha, ajuste: AJUSTE_DE_FIN_DE_SEMANA[e.finDeSemana] };
  }
  return reglaDeIngreso(e);
}

export type HuecoIngreso = 'dia_semana' | 'ancla' | 'dia_mes' | 'monto';

/** Lo que falta para guardar el ingreso, en el orden del formulario (el primero recibe el foco). */
export function huecosIngreso(e: EstadoIngreso): HuecoIngreso[] {
  if (e.frecuencia === 'varia') return [];
  const huecos: HuecoIngreso[] = [];
  if (e.frecuencia === 'semanal' && e.diaSemana === null) huecos.push('dia_semana');
  if (e.frecuencia === 'catorcenal' && e.ancla === null) huecos.push('ancla');
  if (e.frecuencia === 'mensual' && e.diaMes === null) huecos.push('dia_mes');
  if (e.monto === null || e.monto <= 0) huecos.push('monto');
  return huecos;
}

const ETIQUETA_HUECO_INGRESO: Readonly<Record<HuecoIngreso, string>> = {
  dia_semana: ETIQUETA_DIA_SEMANA_INGRESO,
  ancla: ETIQUETA_PROXIMA_VEZ_INGRESO,
  dia_mes: ETIQUETA_DIA_MES_INGRESO,
  monto: FILA_CADA_VEZ,
};

/** «Cada quincena (15 y último)», «Cada viernes», «Cada mes, el día 30», «Varía». */
export function describirFrecuenciaIngreso(e: EstadoIngreso): string {
  switch (e.frecuencia) {
    case 'quincena':
      return e.reglaDicha?.tipo === 'quincenal_dias'
        ? `Los días ${e.reglaDicha.dias[0]} y ${e.reglaDicha.dias[1]}`
        : 'Cada quincena (15 y último)';
    case 'semanal': {
      const dia = OPCIONES_DIA_SEMANA.find((d) => d.valor === e.diaSemana)?.etiqueta;
      return dia ? `Cada ${dia.toLowerCase()}` : 'Cada semana';
    }
    case 'catorcenal':
      return e.ancla ? `Cada 14 días, desde el ${etiquetaFecha(e.ancla)}` : 'Cada 14 días';
    case 'mensual':
      return e.diaMes === null ? 'Cada mes' : `Cada mes, el día ${e.diaMes}`;
    case 'varia':
      return 'Varía';
  }
}

/**
 * Filas de la tarjeta de O3 (maqueta «Onboarding por voz»): cada cuándo, lo que falta, el próximo pago y el fin de
 * semana (la pantalla le pone las opciones). El monto va como cifra grande de la tarjeta, no como fila.
 */
export function filasIngreso(
  e: EstadoIngreso,
  proximo: PlainDate | null,
  finDeSemana: string,
): FilaEntendi[] {
  const filas: FilaEntendi[] = [
    { clave: 'frecuencia', etiqueta: FILA_CADA_CUANDO, valor: describirFrecuenciaIngreso(e) },
  ];
  if (e.frecuencia === 'varia') return filas;
  for (const h of huecosIngreso(e))
    filas.push({ clave: h, etiqueta: ETIQUETA_HUECO_INGRESO[h], valor: FALTA_DATO });
  if (proximo)
    filas.push({ clave: 'proximo', etiqueta: ETIQUETA_PROXIMO_PAGO, valor: etiquetaFecha(proximo) });
  filas.push({ clave: 'fin_de_semana', etiqueta: FILA_FIN_DE_SEMANA, valor: finDeSemana });
  return filas;
}

/** «cuánto te pagan y qué día»: lo que falta, para «Me falta saber…». */
export function faltantesIngreso(e: EstadoIngreso): string[] {
  return huecosIngreso(e).map((h) => FALTANTES_INGRESO[h]);
}

// ——— O4 · Cuentas ———

export interface PlanCuentas {
  /** El efectivo dicho, si todavía no hay efectivo. */
  efectivo: LecturaCuentas['efectivo'] | null;
  /** Las cuentas dichas que no están en la lista. */
  nuevas: CuentaLeida[];
  /** Nombres de las dichas que ya estaban: no se agregan dos veces. */
  yaEstan: string[];
  efectivoYaEsta: boolean;
}

/** Qué se agrega de lo dicho en O4: nada se duplica (ante la duda, no se suma dinero dos veces). */
export function planCuentas(
  l: LecturaCuentas,
  existentes: readonly { nombre: string; subtipo: string }[],
): PlanCuentas {
  const efectivoYaEsta = l.efectivo !== undefined && existentes.some((c) => c.subtipo === 'efectivo');
  const nuevas: CuentaLeida[] = [];
  const yaEstan: string[] = [];
  for (const c of l.cuentas) {
    if (existentes.some((x) => x.subtipo !== 'efectivo' && normal(x.nombre) === normal(c.nombre))) {
      yaEstan.push(c.nombre);
    } else nuevas.push(c);
  }
  return { efectivo: efectivoYaEsta ? null : (l.efectivo ?? null), nuevas, yaEstan, efectivoYaEsta };
}

export function filasCuentas(p: PlanCuentas): FilaEntendi[] {
  return [
    ...(p.efectivo
      ? [
          {
            clave: 'efectivo',
            etiqueta: 'Efectivo',
            valor: cifraDicha(p.efectivo.monto, p.efectivo.aproximado),
          },
        ]
      : []),
    ...p.nuevas.map((c, i) => ({
      clave: `cuenta-${i}`,
      etiqueta: `${c.nombre} · ${ETIQUETAS_SUBTIPO_CUENTA[c.subtipo] ?? ''}`,
      valor: cifraDicha(c.saldo.monto, c.saldo.aproximado),
    })),
  ];
}

/** Lo que no se agrega y por qué, para el pie de la tarjeta. */
export function efectoCuentas(p: PlanCuentas): string | null {
  const partes = [
    ...(p.yaEstan.length > 0 ? [textoYaEstanEnLista(p.yaEstan)] : []),
    ...(p.efectivoYaEsta ? [TEXTO_EFECTIVO_YA_ESTA] : []),
  ];
  return partes.length > 0 ? partes.join(' ') : null;
}

/** Las entradas de `agregarCuentasDichas`. */
export function entradasCuentas(p: PlanCuentas): { efectivo: Centavos | null; cuentas: EntradaCuenta[] } {
  return {
    efectivo: p.efectivo ? p.efectivo.monto : null,
    cuentas: p.nuevas.map((c) => ({
      subtipo: c.subtipo,
      nombre: c.nombre,
      saldo: c.saldo.monto,
      ...(c.institucion ? { institucion: c.institucion } : {}),
    })),
  };
}

/** «BBVA y tu efectivo»: lo que se agregó, sin cifras (va a la línea de «Listo» y al lector de pantalla). */
export function nombresCuentas(p: PlanCuentas): string[] {
  return [...p.nuevas.map((c) => c.nombre), ...(p.efectivo ? ['tu efectivo'] : [])];
}

// ——— O4 · Tarjeta de crédito (`02 §3.1`) ———

export type HuecoTarjeta = 'nombre' | 'corte' | 'limite_pago' | 'limite_credito' | 'modo' | 'saldo' | 'msi';

/** Lo que falta para crear la tarjeta sin formulario. Con meses que ya tenías siempre falta «¿ya los incluye?». */
export function huecosTarjeta(l: LecturaTarjeta): HuecoTarjeta[] {
  const huecos: HuecoTarjeta[] = [];
  if (!l.nombre) huecos.push('nombre');
  if (l.diaCorte === undefined) huecos.push('corte');
  if (l.diaLimitePago === undefined && l.diasParaPagar === undefined) huecos.push('limite_pago');
  if (!l.limiteCredito) huecos.push('limite_credito');
  if (!l.modo) huecos.push('modo');
  if (!l.saldo) huecos.push('saldo');
  if (l.msiPrevios) huecos.push('msi');
  return huecos;
}

export function faltantesTarjeta(l: LecturaTarjeta): string[] {
  return huecosTarjeta(l).map((h) => FALTANTES_TARJETA[h]);
}

/** La tarjeta lista para `agregarTarjetaCredito`, o `null` si falta algo. */
export function entradaTarjeta(l: LecturaTarjeta): EntradaTarjeta | null {
  if (huecosTarjeta(l).length > 0) return null;
  const { nombre, diaCorte, limiteCredito, modo, saldo } = l;
  if (!nombre || diaCorte === undefined || !limiteCredito || !modo || !saldo) return null;
  return {
    nombre,
    ...(l.ultimos4 ? { ultimos4: l.ultimos4 } : {}),
    alias: [nombre],
    diaCorte,
    ...(l.diaLimitePago !== undefined ? { diaLimitePago: l.diaLimitePago } : {}),
    ...(l.diasParaPagar !== undefined ? { diasParaPagar: l.diasParaPagar } : {}),
    limiteCredito: limiteCredito.monto,
    modo,
    saldo: saldo.monto,
  };
}

/** Lo dicho de una tarjeta, como lo recibe `useFormularioTarjeta` (`PrellenadoFormularioTarjeta`). */
export interface TarjetaDichaPrellenada extends TarjetaPorAgregar {
  readonly nombre: string | null;
  readonly ultimos4: string | null;
  readonly saldo: Centavos | null;
  readonly modo: 'totalero' | 'plan' | null;
  readonly limiteCredito: Centavos | null;
}

/** Todo lo dicho va al formulario de tarjeta (ciclo, nombre, últimos 4, saldo, modo y límite): nada se reescribe. */
export function prellenadoTarjeta(l: LecturaTarjeta): TarjetaDichaPrellenada {
  return {
    alias: l.nombre ?? null,
    diaCorte: l.diaCorte ?? null,
    diaLimitePago: l.diaLimitePago ?? null,
    diasParaPagar: l.diaLimitePago === undefined ? (l.diasParaPagar ?? null) : null,
    nombre: l.nombre ?? null,
    ultimos4: l.ultimos4 ?? null,
    saldo: l.saldo?.monto ?? null,
    modo: l.modo ?? null,
    limiteCredito: l.limiteCredito?.monto ?? null,
  };
}

/**
 * Lo que la persona tiene que escribir en el formulario de tarjeta después de «Dímelo»: solo lo que falta (lo dicho
 * ya llega escrito con `prellenadoTarjeta`). Vacío si no falta nada.
 */
export function pendientesTarjeta(l: LecturaTarjeta): string[] {
  return faltantesTarjeta(l);
}

/** Lo que el paso O4 deja para la pantalla de tarjeta (sin URL: los datos dichos no viajan en la ruta). */
let tarjetaPendiente: LecturaTarjeta | null = null;
export function dejarTarjetaDicha(l: LecturaTarjeta): void {
  tarjetaPendiente = l;
}
export function tomarTarjetaDicha(): LecturaTarjeta | null {
  const l = tarjetaPendiente;
  tarjetaPendiente = null;
  return l;
}

export function filasTarjeta(l: LecturaTarjeta): FilaEntendi[] {
  const filas: FilaEntendi[] = [];
  const fila = (clave: keyof typeof FILAS_TARJETA, valor: string) =>
    filas.push({ clave, etiqueta: FILAS_TARJETA[clave], valor });
  if (l.nombre) fila('nombre', l.ultimos4 ? `${l.nombre} · ${l.ultimos4}` : l.nombre);
  if (l.diaCorte !== undefined) fila('corte', `El ${l.diaCorte}`);
  if (l.diaLimitePago !== undefined) fila('limite_pago', `El ${l.diaLimitePago}`);
  else if (l.diasParaPagar !== undefined) fila('limite_pago', `${l.diasParaPagar} días después del corte`);
  if (l.limiteCredito) fila('limite_credito', cifraDicha(l.limiteCredito.monto, l.limiteCredito.aproximado));
  if (l.saldo) fila('saldo', cifraDicha(l.saldo.monto, l.saldo.aproximado));
  if (l.modo) fila('modo', l.modo === 'totalero' ? 'Sí, completa' : 'No, en pagos');
  return filas;
}

// ——— O5 · Pagos fijos ———

export type HuecoPago = 'frecuencia' | 'dia' | 'dia_semana' | 'mes';

export interface PagoPlaneado<C extends string = string> {
  /** Como se muestra: «Renta», «Netflix». */
  concepto: string;
  /** Como se guarda: el del catálogo si es uno de los chips («renta»); si no, como se dijo. */
  conceptoGuardado: string;
  monto: Centavos;
  aproximado: boolean;
  regla: Regla | null;
  categoria: string | null;
  variable: boolean;
  /** La cuenta de salida dicha («sale de la BBVA») si es una sola de las que hay; `null` = se decide después. */
  cuentaId: string | null;
  pagosRestantes: number | null;
  huecos: HuecoPago[];
  /** Lo dicho como lo llena `FormularioPagoFijo`, si falta algo o se quiere cambiar. */
  prellenado: PagoPrellenado<C>;
}

/**
 * Cada pago dicho con su regla (si está completa) y lo que le falta. La traducción a los campos del formulario es
 * la de `prellenadoDePagoLeido` (la misma de «O dímelo» en Cuentas); aquí solo se decide si alcanza para guardar.
 */
export function planPagos<C extends string>(
  pagos: readonly PagoLeido[],
  sugeridos: readonly {
    readonly clave: C;
    readonly concepto: string;
    readonly categoria: string | null;
    readonly variable: boolean;
  }[],
  cuentas: readonly { id: string; nombre: string }[] = [],
): PagoPlaneado<C>[] {
  return pagos.map((p) => {
    const prellenado = prellenadoDePagoLeido(p, sugeridos, cuentas);
    const sugerido = sugeridos.find((s) => s.clave === prellenado.clave) ?? null;
    // Cada 14 días no tiene chip: la regla dicha va tal cual.
    const sinChip = p.regla !== undefined && p.frecuencia === undefined;
    const regla = sinChip ? (p.regla as Regla) : p.frecuencia ? reglaDePago(prellenado.respuestas) : null;
    const huecos: HuecoPago[] = [];
    if (regla === null) {
      if (!p.frecuencia) huecos.push('frecuencia');
      else if (p.frecuencia === 'semanal') huecos.push('dia_semana');
      else {
        if (p.frecuencia === 'anual' && prellenado.respuestas.mes === null) huecos.push('mes');
        huecos.push('dia');
      }
    }
    return {
      concepto: prellenado.nombre,
      conceptoGuardado: sugerido ? sugerido.concepto : p.concepto,
      monto: p.monto.monto,
      aproximado: p.monto.aproximado,
      regla,
      categoria: sugerido?.categoria ?? null,
      variable: sugerido?.variable ?? false,
      cuentaId: prellenado.cuentaId,
      pagosRestantes: p.pagosRestantes ?? null,
      huecos,
      prellenado,
    };
  });
}

/** «qué día pagas Netflix»: lo primero que le falta a cada pago incompleto, para «Me falta saber…». */
export function faltantesPagos(pagos: readonly PagoPlaneado[]): string[] {
  return pagos.flatMap((p) => {
    const h = p.huecos[0];
    return h ? [`${FALTANTES_PAGO_FRASE[h]} ${p.concepto}`] : [];
  });
}

export function filasPagos(pagos: readonly PagoPlaneado[]): FilaEntendi[] {
  return pagos.map((p, i) => ({
    clave: `pago-${i}`,
    etiqueta: `${p.concepto} · ${p.regla ? describirRegla(p.regla) : `${FALTA_DATO.toLowerCase()} ${FALTANTES_PAGO[p.huecos[0] ?? 'frecuencia']}`}`,
    valor: cifraDicha(p.monto, p.aproximado),
  }));
}
