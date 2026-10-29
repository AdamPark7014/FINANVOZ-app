/**
 * Seguimientos del nivel 0 (docs/06-NLU.md §15): frases que solo se entienden con el turno anterior de la
 * conversación (`contexto.anterior`, lo dicho y lo que se entendió). Responden la intención completa, nunca un
 * «seguimiento»: «¿y la semana pasada?» tras «¿cuánto gasté en comida esta semana?» es la misma consulta con otro
 * periodo; «no, en efectivo» o «quítale 10» corrigen el último movimiento; «otra igual» lo repite; «¿y a 6 meses?»
 * rehace la simulación; y la respuesta a una aclaración («45», «esta semana», «$250», «el jueves») completa la frase
 * que se aclaraba. Las cuentas (quitarle o sumarle a la cifra, el día de la semana pasada) las hace este código,
 * nunca el modelo (regla 4). Si dudan, `null`.
 */
import { sumarDias, type Centavos } from '@cartera/core';
import type { Categoria, Interpretacion, Movimiento, RefCuenta } from '../esquema';
import { leerCategoria, leerCategoriaConsulta } from './categorias';
import { buscarEnDiccionario } from './diccionario';
import type { Entorno } from './entorno';
import {
  hastaElIngreso,
  leerFechaRegistro,
  leerFechaSimulacion,
  leerPeriodo,
  leerPeriodoAdelante,
  lunesDe,
} from './fechas';
import { Lector } from './lector';
import { leerEntero, leerMonto } from './montos';
import { ubicarMontoAmbiguo } from './sin-nube';
import { SEP, sinSeparadores, sinAcentosConEnie, tokenizar, type Tokens } from './tokens';

/** Vuelve a interpretar un texto con el nivel 0, sin turno anterior (lo da `index.ts`; evita la importación circular). */
export type Reinterpretar = (texto: string) => Interpretacion | null;

type Consulta = Extract<Interpretacion, { intencion: 'consultar' }>['consulta'];
type Compra = Extract<Interpretacion, { intencion: 'simular' }>['compra'];
type Cambios = Extract<Interpretacion, { intencion: 'corregir' }>['cambios'];

const consultar = (consulta: Consulta): Interpretacion => ({ intencion: 'consultar', consulta });
const corregirUltimo = (cambios: Cambios): Interpretacion => ({
  intencion: 'corregir',
  objetivo: { ultimo: true },
  cambios,
});

const DIAS: Readonly<Record<string, number>> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};

/** Conjunciones con que empieza un seguimiento: «y», «e», «también», «además», «ah». */
const CONJUNCIONES = new Set(['y', 'e', 'tambien', 'ademas', 'ah', 'oye', 'pues']);

/** Una cifra en dígitos con punto decimal solo si hay centavos: 25000 → "250"; 250 → "2.50". */
function cifra(centavos: Centavos): string {
  const pesos = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return resto === 0 ? String(pesos) : `${pesos}.${String(resto).padStart(2, '0')}`;
}

/** El texto crudo (con mayúsculas, para los comercios) de los tokens, sin separadores. */
const crudo = (tokens: Tokens) => sinSeparadores(tokens).c.join(' ');

/** Tokens sin las conjunciones del inicio. */
function sinConjuncion(tokens: Tokens): { tokens: Tokens; quitadas: number } {
  const s = sinSeparadores(tokens);
  let i = 0;
  while (i < s.t.length - 1 && CONJUNCIONES.has(s.t[i] ?? '')) i++;
  return { tokens: { t: s.t.slice(i), o: s.o.slice(i), c: s.c.slice(i) }, quitadas: i };
}

// ——— Respuesta a una aclaración ———

const AFIRMA_COMPRA = ['me', 'alcanza'];

/**
 * La respuesta a una aclaración del turno anterior: completa la frase que se aclaraba. Se prueba antes que todo lo
 * demás: «unos tenis de 1,200» tras «¿me alcanza?» es la compra, no un gasto nuevo. Si la frase no responde la
 * pregunta (es otra cosa completa), `null` y sigue el camino normal.
 */
export function respuestaAclaracion(
  entrada: Tokens,
  env: Entorno,
  reinterpretar: Reinterpretar,
): Interpretacion | null {
  const anterior = env.anterior;
  if (anterior?.interpretacion.intencion !== 'aclarar') return null;
  const aclarar = anterior.interpretacion;
  const previa = tokenizar(anterior.frase);
  const tPrevia = previa.t.filter((p) => p !== SEP);
  // La app manda la respuesta pegada a la frase de antes («¿me alcanza?, unos tenis de 1,200»): se queda lo nuevo.
  const sin = sinSeparadores(entrada);
  const n = tPrevia.length;
  const pegada = n > 0 && tPrevia.every((p, i) => sin.t[i] === p) && sin.t.length > n;
  const tokens: Tokens = pegada ? { t: sin.t.slice(n), o: sin.o.slice(n), c: sin.c.slice(n) } : entrada;
  const respuesta = crudo(tokens);
  if (respuesta === '') return null;
  const acepta = (i: Interpretacion | null) =>
    i && i.intencion !== 'aclarar' && i.intencion !== 'fuera_de_alcance' ? i : null;

  switch (aclarar.motivo) {
    case 'monto_ambiguo':
      return elegirMonto(tokens, previa, aclarar.opciones ?? [], reinterpretar);
    case 'fecha_ambigua': {
      // «la semana pasada me compré…» → «el jueves»: ese día de la semana pasada.
      const k = tPrevia.findIndex((p, i) => p === 'semana' && tPrevia[i + 1] === 'pasada');
      if (k >= 0 && !tPrevia.includes('cuanto'))
        return diaDeLaSemanaPasada(tokens, previa, env, reinterpretar);
      break;
    }
    case 'monto_faltante': {
      // «¿me alcanza [para unos tenis]?» → «unos tenis de 1,200» / «1,200»
      if (
        AFIRMA_COMPRA.every((p, i) => tPrevia[i] === p) ||
        (tPrevia[0] === 'me' && tPrevia[1] === 'alcanzaria')
      ) {
        const simulada =
          acepta(reinterpretar(`${crudo(previa)} de ${respuesta}`)) ??
          acepta(reinterpretar(`me alcanza para ${respuesta}`));
        if (simulada?.intencion === 'simular') return simulada;
        const l = new Lector(sinSeparadores(tokens));
        const monto = leerMonto(l);
        if (monto && monto.monto > 0 && l.fin)
          return { intencion: 'simular', compra: { precio: monto.monto } };
        return null;
      }
      break;
    }
    default:
      break;
  }
  // Lo demás: la frase de antes con la respuesta pegada tras una coma («me compré un café, 45»).
  return acepta(reinterpretar(`${anterior.frase}, ${respuesta}`));
}

/** «$250» tras «¿Fueron $2.50 o $250?»: la frase de antes con esa cifra en lugar de «dos cincuenta». */
function elegirMonto(
  tokens: Tokens,
  previa: Tokens,
  opciones: readonly string[],
  reinterpretar: Reinterpretar,
): Interpretacion | null {
  const sin = sinSeparadores(previa);
  const u = ubicarMontoAmbiguo(sin.t);
  if (!u) return null;
  const l = new Lector(sinSeparadores(tokens));
  l.palabra('fueron', 'fue', 'son', 'eran', 'era');
  const dicho = leerMonto(l);
  if (!dicho || !l.fin) return null;
  const validas = new Set([u.centavos, u.cientos]);
  for (const o of opciones) {
    const lo = new Lector(tokenizar(o));
    const m = leerMonto(lo);
    if (m) validas.add(m.monto);
  }
  if (!validas.has(dicho.monto) || (dicho.monto !== u.centavos && dicho.monto !== u.cientos)) return null;
  const texto = [...sin.c.slice(0, u.inicio), cifra(dicho.monto), ...sin.c.slice(u.fin)].join(' ');
  const r = reinterpretar(texto);
  return r?.intencion === 'registrar' ? r : null;
}

/** «el jueves» tras «¿Qué día de la semana pasada fue?»: ese día de la semana anterior a la de hoy. */
function diaDeLaSemanaPasada(
  tokens: Tokens,
  previa: Tokens,
  env: Entorno,
  reinterpretar: Reinterpretar,
): Interpretacion | null {
  const l = new Lector(sinSeparadores(tokens));
  l.palabra('fue', 'era');
  l.palabra('el');
  const dia = DIAS[l.ver() ?? ''];
  if (dia === undefined) return null;
  l.pos++;
  l.palabra('pasado');
  if (!l.fin) return null;
  const fecha = sumarDias(sumarDias(lunesDe(env.hoy), -7), dia - 1);
  const sin = sinSeparadores(previa);
  const k = sin.t.findIndex((p, i) => p === 'semana' && sin.t[i + 1] === 'pasada');
  if (k < 0) return null;
  const desde = sin.t[k - 1] === 'la' ? k - 1 : k;
  const texto = [...sin.c.slice(0, desde), ...sin.c.slice(k + 2)].join(' ');
  const r = reinterpretar(texto);
  if (r?.intencion !== 'registrar') return null;
  return { intencion: 'registrar', movimientos: r.movimientos.map((m) => ({ ...m, fecha })) };
}

// ——— Seguimientos ———

/** Seguimiento del turno anterior; `null` si la frase no lo es o si no hay turno anterior. */
export function seguimiento(tokens: Tokens, env: Entorno): Interpretacion | null {
  const anterior = env.anterior;
  if (!anterior) return null;
  const { tokens: cuerpo } = sinConjuncion(tokens);
  const i = anterior.interpretacion;
  switch (i.intencion) {
    case 'consultar':
      return seguirConsulta(cuerpo, env, i.consulta);
    case 'registrar':
      return seguirRegistro(cuerpo, env, i.movimientos, null);
    case 'corregir':
      return seguirRegistro(cuerpo, env, [], i.cambios.monto ?? null);
    case 'simular':
      return seguirSimulacion(cuerpo, env, i.compra);
    case 'aclarar':
      return seguirAclaracionDeConsulta(cuerpo, env, i);
    default:
      return null;
  }
}

/** «esta semana» tras «¿De cuándo?» de una consulta de gasto: la consulta con ese periodo. */
function seguirAclaracionDeConsulta(
  tokens: Tokens,
  env: Entorno,
  aclarar: Extract<Interpretacion, { intencion: 'aclarar' }>,
): Interpretacion | null {
  const parcial = aclarar.parcial?.consulta as Partial<Consulta> | undefined;
  if (aclarar.motivo !== 'fecha_ambigua' || !parcial) return null;
  if (parcial.tipo !== 'gasto_total' && parcial.tipo !== 'gasto_por_categoria') return null;
  const l = new Lector(tokens);
  const periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
  if (!periodo || !l.fin) return null;
  return consultar({
    tipo: parcial.tipo,
    desde: periodo.desde,
    hasta: periodo.hasta,
    ...(parcial.categoria !== undefined ? { categoria: parcial.categoria } : {}),
  });
}

const TIPOS_CON_GASTO = new Set<Consulta['tipo']>(['gasto_total', 'gasto_por_categoria', 'mayores_gastos']);

/** «¿y la semana pasada?», «¿y en comida?», «¿y en total?», «¿y en la Nu?», «¿y Juan?», «¿por qué?». */
function seguirConsulta(tokens: Tokens, env: Entorno, c: Consulta): Interpretacion | null {
  const l = new Lector(tokens);
  // «¿y cuánto en comida?», «¿y qué tal en súper?»
  l.alguna(['cuanto', 'llevo'], ['cuanto', 'gaste'], ['cuanto'], ['que', 'tal']);
  const inicio = l.marca();
  const rango = { desde: c.desde, hasta: c.hasta };
  const conRango = rango.desde !== undefined && rango.hasta !== undefined;

  // «¿por qué?» / «¿por qué tan poco?» tras «¿cuánto puedo gastar hoy?» → el desglose de hoy.
  if (c.tipo === 'hoy_puedes' && l.secuencia('por', 'que')) {
    l.alguna(['tan', 'poco'], ['tan', 'poquito'], ['es', 'tan', 'poco'], ['tan', 'poco', 'hoy']);
    return l.fin ? consultar({ tipo: 'desglose_hoy' }) : null;
  }
  l.volver(inicio);

  // Otro periodo.
  if (c.tipo === 'compromisos') {
    const adelante = leerPeriodoAdelante(l, env.hoy, env.proximoIngreso);
    if (adelante && l.fin)
      return consultar({ tipo: 'compromisos', desde: adelante.desde, hasta: adelante.hasta });
    l.volver(inicio);
    if (l.alguna(['antes'], ['antes', 'de', 'eso']) && l.fin) {
      const r = hastaElIngreso(env.hoy, env.proximoIngreso);
      return consultar({ tipo: 'compromisos', desde: r.desde, hasta: r.hasta });
    }
    return null;
  }
  const periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
  if (periodo && l.fin) {
    if (TIPOS_CON_GASTO.has(c.tipo) || c.tipo === 'deducciones' || (c.tipo === 'impuestos' && env.negocio)) {
      return consultar({ ...c, desde: periodo.desde, hasta: periodo.hasta });
    }
    return null;
  }
  l.volver(inicio);

  // En total.
  if (l.alguna(['en', 'total'], ['en', 'todo'], ['total'], ['todo'], ['en', 'general']) && l.fin) {
    if ((c.tipo === 'gasto_por_categoria' || c.tipo === 'gasto_total') && conRango) {
      return consultar({ tipo: 'gasto_total', desde: c.desde, hasta: c.hasta });
    }
    if (c.tipo === 'saldo') return consultar({ tipo: 'saldo' });
    if (c.tipo === 'comparar_periodos' && c.actual && c.anterior) {
      return consultar({ tipo: 'comparar_periodos', actual: c.actual, anterior: c.anterior });
    }
    return null;
  }
  l.volver(inicio);

  // Una cuenta: «¿y en la Nu?», «¿y en efectivo?» tras un saldo o la deuda de las tarjetas.
  if (c.tipo === 'saldo' || c.tipo === 'deuda_tarjetas') {
    if (l.palabra('en', 'de', 'a')) {
      const ref = env.alias(l, c.tipo === 'deuda_tarjetas' ? ['credito'] : undefined);
      if (ref?.alias !== undefined && l.fin) return consultar({ tipo: 'saldo', alias: ref.alias });
    }
    return null;
  }

  // Una persona: «¿y Juan?» tras «¿quién me debe?».
  if (c.tipo === 'por_cobrar') {
    const p = env.persona(l);
    return p && !p.cliente && l.fin ? consultar({ tipo: 'por_cobrar', contraparte: p.contraparte }) : null;
  }

  // Otra categoría (con o sin otro periodo): «¿y en comida?», «¿y de uber el mes pasado?».
  if (TIPOS_CON_GASTO.has(c.tipo) || c.tipo === 'comparar_periodos') {
    if (!l.palabra('en', 'de')) return null;
    const categoria = leerCategoriaConsulta(l);
    if (!categoria) return null;
    if (c.tipo === 'comparar_periodos') {
      return l.fin && c.actual && c.anterior
        ? consultar({ tipo: 'comparar_periodos', categoria, actual: c.actual, anterior: c.anterior })
        : null;
    }
    const otro = l.fin ? null : leerPeriodo(l, env.hoy, env.ultimoIngreso);
    if (!l.fin) return null;
    const r = otro ?? (conRango ? rango : null);
    if (!r?.desde || !r.hasta) return null;
    return consultar({ tipo: 'gasto_por_categoria', desde: r.desde, hasta: r.hasta, categoria });
  }
  return null;
}

// ——— Registros ———

const PRONOMBRES_BORRAR = new Set(
  ['borra', 'quita', 'elimina', 'cancela', 'anula'].flatMap((v) =>
    ['lo', 'la', 'los', 'las'].map((p) => `${v}${p}`),
  ),
);
const DESHAZ = new Set(['deshazlo', 'deshazla', 'deshazlos', 'deshazlas']);
const RESTAR = new Set(['quitale', 'restale', 'bajale', 'descuentale', 'quitales', 'restales', 'bajales']);
const SUMAR = new Set(['sumale', 'agregale', 'aumentale', 'subele', 'sumales', 'agregales', 'aumentales']);
const MOVER = new Set(
  ['pon', 'pasa', 'cambia', 'mueve', 'manda'].flatMap((v) =>
    ['lo', 'la', 'los', 'las'].map((p) => `${v}${p}`),
  ),
);
const FUE = ['fue', 'fueron', 'era', 'eran', 'es', 'son'];
/** Movimientos donde «con la Nu» dice de dónde salió el dinero (el origen que se corrige). */
const CON_ORIGEN = new Set<Movimiento['tipo']>([
  'gasto',
  'compra_msi',
  'cuenta_dividida',
  'prestamo_otorgado',
  'pago_prestamo',
  'aportacion_tanda',
  'pago_tarjeta',
]);
/** Movimientos que llevan una categoría de gasto. */
const CON_CATEGORIA_GASTO = new Set<Movimiento['tipo']>(['gasto', 'compra_msi', 'cuenta_dividida']);

/**
 * Tras un registro (o una corrección): «otra igual», «otro de 95», «no, en efectivo», «con BBVA», «fue ayer»,
 * «ponlo en súper», «quítale 10», «bórralo». `ms` son los movimientos registrados (vacío tras una corrección);
 * `montoBase` es el monto ya corregido, si la corrección lo cambió.
 */
function seguirRegistro(
  tokens: Tokens,
  env: Entorno,
  ms: readonly Movimiento[],
  montoBase: Centavos | null,
): Interpretacion | null {
  const l = new Lector(tokens);
  const ultimo = ms[ms.length - 1];
  const base = montoBase ?? (ms.length === 1 && ultimo ? ultimo.monto : null);

  // Bórralo / bórrala / quita eso
  const primera = l.ver() ?? '';
  if ((PRONOMBRES_BORRAR.has(primera) || DESHAZ.has(primera)) && l.t.length === 1) {
    return { intencion: 'anular', objetivo: { ultimo: true } };
  }
  if (l.palabra('borra', 'quita', 'cancela', 'deshaz', 'elimina', 'anula') && l.palabra('eso') && l.fin) {
    return { intencion: 'anular', objetivo: { ultimo: true } };
  }
  l.volver(0);

  // Quítale 10 / súmale 15 / ponle 10 más / eran 10 menos: la cuenta la hace el teléfono (regla 4).
  if (base !== null) {
    const ajuste = ajusteDeMonto(l);
    if (ajuste !== null) {
      const nuevo = base + ajuste;
      return nuevo > 0 && nuevo !== base ? corregirUltimo({ monto: nuevo }) : null;
    }
  }
  l.volver(0);

  // Otra igual / otro de 95 / otra igual pero con la Nu
  if (ms.length > 0) {
    const otra = otraIgual(l, env, ms);
    if (otra !== undefined) return otra;
  }
  l.volver(0);

  // Correcciones del último: «no, en efectivo», «fue ayer», «eran 850», «ponlo en súper», «los pagué con la Nu».
  return corregirElUltimo(l, env, ultimo ?? null, ms.length > 0 || montoBase !== null);
}

/** «quítale 10» → −1000; «súmale 15», «ponle 15 más», «eran 15 más» → +1500. `null` si no es un ajuste. */
function ajusteDeMonto(l: Lector): number | null {
  const verbo = l.ver() ?? '';
  if (RESTAR.has(verbo) || SUMAR.has(verbo)) {
    l.pos++;
    l.palabra('otros', 'otras');
    const m = leerMonto(l);
    l.palabra('mas');
    return m && m.monto > 0 && !m.aproximado && l.fin ? (RESTAR.has(verbo) ? -m.monto : m.monto) : null;
  }
  if (l.palabra('ponle', 'ponles') || l.palabra(...FUE)) {
    const m = leerMonto(l);
    if (!m || m.monto <= 0 || m.aproximado) return null;
    if (l.palabra('mas') && l.fin) return m.monto;
    if (l.palabra('menos') && l.fin) return -m.monto;
  }
  return null;
}

/** OTRA := (otra|otro) [igual] | otros iguales | lo mismo | una más | uno más … [pero] [METODO | de MONTO [METODO]]. */
function otraIgual(l: Lector, env: Entorno, ms: readonly Movimiento[]): Interpretacion | null | undefined {
  const igual = l.alguna(
    ['otra', 'vez', 'lo', 'mismo'],
    ['otra', 'igual'],
    ['otro', 'igual'],
    ['otras', 'iguales'],
    ['otros', 'iguales'],
    ['lo', 'mismo'],
    ['una', 'mas'],
    ['uno', 'mas'],
    ['una', 'igual'],
    ['uno', 'igual'],
  );
  const suelta = !igual && l.palabra('otra', 'otro');
  if (!igual && !suelta) return undefined;
  // «otra igual» con dos o más movimientos no dice cuál: solo «lo mismo» u «otros iguales» los repiten todos.
  const plural =
    l.t[0] === 'lo' || l.t[0] === 'otros' || l.t[0] === 'otras' || l.t.slice(0, 2).join(' ') === 'otra vez';
  if (ms.length > 1 && !plural) return null;
  if (l.fin) return { intencion: 'registrar', movimientos: ms.map((m) => ({ ...m })) };
  l.palabra('pero', 'y');
  const metodo = env.metodo(l);
  if (metodo && l.fin) {
    if (!ms.every((m) => CON_ORIGEN.has(m.tipo))) return null;
    return { intencion: 'registrar', movimientos: ms.map((m) => ({ ...m, origen: metodo })) };
  }
  // «otro de 95 [con la Nu]»: lo mismo con otra cifra; la cuenta no se hereda (si no la dice, queda por asignar).
  const [unico] = ms;
  if (ms.length !== 1 || unico?.tipo !== 'gasto') return null;
  l.palabra('de', 'por');
  const m = leerMonto(l);
  if (!m || m.monto <= 0) return null;
  const otroMetodo = l.fin ? null : env.metodo(l);
  if (!l.fin) return null;
  const { aproximado: _antes, ...resto } = unico;
  void _antes;
  return {
    intencion: 'registrar',
    movimientos: [
      {
        ...resto,
        monto: m.monto,
        origen: otroMetodo ?? { tipo: 'desconocido' },
        ...(m.aproximado ? { aproximado: true } : {}),
      },
    ],
  };
}

/** Corrección del último movimiento sin nombrarlo. `conRegistro`: el turno anterior registró o corrigió algo. */
function corregirElUltimo(
  l: Lector,
  env: Entorno,
  ultimo: Movimiento | null,
  conRegistro: boolean,
): Interpretacion | null {
  if (!conRegistro) return null;
  const tipo = ultimo?.tipo ?? 'gasto';
  const inicio = l.marca();
  l.palabra('no');
  l.palabra('mejor');
  const despues = l.marca();

  // ponlo en súper / pásala a entretenimiento / cámbialo a antojos
  if (MOVER.has(l.ver() ?? '')) {
    l.pos++;
    l.palabra('a', 'en');
    l.alguna(['la', 'categoria', 'de'], ['la', 'de'], ['categoria']);
    const categoria = categoriaDeGasto(l, tipo);
    return categoria && l.fin ? corregirUltimo({ categoria }) : null;
  }
  l.volver(despues);

  // [lo|la|los|las] pagué METODO / (fue|era|…) METODO | FECHA | [de] MONTO | [de|en] CATEGORIA
  const conVerbo =
    l.alguna(
      ['lo', 'pague'],
      ['la', 'pague'],
      ['los', 'pague'],
      ['las', 'pague'],
      ['lo', 'compre'],
      ['la', 'compre'],
      ['los', 'compre'],
      ['las', 'compre'],
    ) || l.palabra(...FUE);
  const despuesDeVerbo = l.marca();
  const origen = env.metodo(l);
  if (origen && l.fin) return CON_ORIGEN.has(tipo) ? corregirUltimo({ origen }) : null;
  l.volver(despuesDeVerbo);
  l.palabra('de');
  const fecha = leerFechaRegistro(l, env.hoy);
  if (fecha !== null && l.fin && (conVerbo || l.t[inicio] === 'no')) return corregirUltimo({ fecha });
  l.volver(despuesDeVerbo);
  if (conVerbo) {
    l.palabra('de');
    const m = leerMonto(l);
    if (m && m.monto > 0 && l.fin) return corregirUltimo({ monto: m.monto });
    l.volver(despuesDeVerbo);
    l.palabra('de', 'en');
    const categoria = categoriaDeGasto(l, tipo);
    if (categoria && l.fin) return corregirUltimo({ categoria });
  }
  return null;
}

/** Categoría de gasto dicha por su nombre, solo para un movimiento que la lleva. */
function categoriaDeGasto(l: Lector, tipo: Movimiento['tipo']): Categoria | null {
  if (!CON_CATEGORIA_GASTO.has(tipo)) return null;
  return leerCategoria(l);
}

// ——— «¿Me alcanza?» ———

const VERBOS_COMPRA = ['saco', 'compro', 'pago', 'pido', 'agarro', 'compre'];

/** «¿y a 6 meses?», «¿y de contado?», «¿y si espero a la quincena?», «¿y de 900?», «ya la compré». */
function seguirSimulacion(tokens: Tokens, env: Entorno, p: Compra): Interpretacion | null {
  const l = new Lector(tokens);
  const comprada = yaLaCompre(l, env, p);
  if (comprada !== undefined) return comprada;
  l.volver(0);
  l.palabra('si');
  l.palabra('me');
  l.palabra('lo', 'la', 'los', 'las');
  l.palabra(...VERBOS_COMPRA);
  const inicio = l.marca();
  const rehacer = (cambios: Partial<Compra>, quitarMeses = false): Interpretacion => {
    const { meses: _meses, ...sinMeses } = p;
    void _meses;
    return { intencion: 'simular', compra: { ...(quitarMeses ? sinMeses : p), ...cambios } };
  };

  // a N meses [sin intereses] [con la Nu]
  if (l.palabra('a')) {
    const meses = leerEntero(l, 48);
    if (meses !== null && meses >= 2 && l.palabra('meses', 'msi')) {
      l.alguna(['sin', 'intereses'], ['msi']);
      if (!l.fin) env.metodo(l);
      if (l.fin) return rehacer({ meses });
    }
    return null;
  }
  l.volver(inicio);
  // de contado / sin meses
  if (l.alguna(['de', 'contado'], ['sin', 'meses'], ['en', 'una', 'sola', 'exhibicion']) && l.fin) {
    return rehacer({}, true);
  }
  l.volver(inicio);
  // espero a la quincena / en la quincena / el viernes / mañana
  if (
    l.alguna(
      ['espero', 'a', 'la', 'quincena'],
      ['me', 'espero', 'a', 'la', 'quincena'],
      ['espero', 'a', 'que', 'me', 'paguen'],
      ['me', 'espero', 'a', 'que', 'me', 'paguen'],
      ['en', 'la', 'quincena'],
      ['para', 'la', 'quincena'],
      ['hasta', 'la', 'quincena'],
      ['en', 'la', 'proxima', 'quincena'],
    ) &&
    l.fin
  ) {
    const r = hastaElIngreso(env.hoy, env.proximoIngreso);
    return env.proximoIngreso !== undefined && r.hasta === env.proximoIngreso
      ? rehacer({ fecha: env.proximoIngreso })
      : null;
  }
  l.volver(inicio);
  const fecha = leerFechaSimulacion(l, env.hoy, env.proximoIngreso);
  if (fecha !== null && fecha > env.hoy && l.fin) return rehacer({ fecha });
  l.volver(inicio);
  // de 900 / si cuestan 900 / unos de 900
  l.alguna(
    ['cuesta'],
    ['cuestan'],
    ['sale'],
    ['salen'],
    ['costara'],
    ['costaran'],
    ['fuera'],
    ['fueran'],
    ['unos'],
    ['unas'],
    ['uno'],
    ['una'],
  );
  l.palabra('de', 'en');
  const m = leerMonto(l);
  if (m && m.monto > 0 && !m.aproximado && l.fin && m.monto !== p.precio) return rehacer({ precio: m.monto });
  return null;
}

/** «ya la compré [con la Nu]»: registra la compra simulada; a meses es una compra a meses. `undefined` si no es eso. */
function yaLaCompre(l: Lector, env: Entorno, p: Compra): Interpretacion | null | undefined {
  l.palabra('si', 'ya', 'pues', 'listo');
  l.palabra('ya');
  l.palabra('me');
  if (!(l.palabra('lo', 'la', 'los', 'las') && l.palabra('compre', 'pedi', 'agarre', 'saque', 'lleve')))
    return undefined;
  const origen = l.fin ? null : env.metodo(l);
  if (!l.fin) return null;
  // El gasto se describe como los demás, sin artículo («unos tenis» → «tenis»).
  const descripcion = p.descripcion?.replace(/^(un|una|unos|unas|el|la|los|las)\s+/i, '');
  const categoria = categoriaDeDescripcion(descripcion);
  const base = {
    monto: p.precio,
    fecha: env.hoy,
    ...(descripcion ? { descripcion } : {}),
    ...(categoria ? { categoria } : {}),
  };
  if (p.meses !== undefined) {
    if (origen && origen.tipo !== 'credito') return null;
    return {
      intencion: 'registrar',
      movimientos: [
        { tipo: 'compra_msi', ...base, origen: origen ?? { tipo: 'credito' }, msi: { meses: p.meses } },
      ],
    };
  }
  return {
    intencion: 'registrar',
    movimientos: [
      { tipo: 'gasto', ...base, origen: origen ?? ({ tipo: 'desconocido' } satisfies RefCuenta) },
    ],
  };
}

/** La categoría de una descripción si todas sus palabras del diccionario son de una sola. */
function categoriaDeDescripcion(descripcion: string | undefined): Categoria | null {
  if (!descripcion) return null;
  const palabras = sinAcentosConEnie(descripcion)
    .split(/\s+/)
    .filter((x) => x !== '');
  const { categorias } = buscarEnDiccionario(palabras);
  const [unica] = categorias;
  return categorias.size === 1 && unica ? unica : null;
}

// ——— «ayer también me tomé una igual» ———

/** [FECHA] [también] VERBO (una|uno|otra|otro) igual: el movimiento anterior otra vez, en esa fecha. */
export function otraIgualConFecha(tokens: Tokens, env: Entorno): Interpretacion | null {
  const anterior = env.anterior?.interpretacion;
  if (anterior?.intencion !== 'registrar' || anterior.movimientos.length !== 1) return null;
  const l = new Lector(sinSeparadores(tokens));
  const fecha = leerFechaRegistro(l, env.hoy);
  l.palabra('tambien');
  l.palabra('me');
  if (!l.palabra('tome', 'eche', 'compre', 'comi', 'gaste')) return null;
  if (!l.alguna(['una', 'igual'], ['uno', 'igual'], ['otra', 'igual'], ['otro', 'igual'], ['otra'], ['otro']))
    return null;
  const despues = fecha === null ? leerFechaRegistro(l, env.hoy) : null;
  if (!l.fin) return null;
  const dia = fecha ?? despues;
  return {
    intencion: 'registrar',
    movimientos: anterior.movimientos.map((m) => ({ ...m, ...(dia !== null ? { fecha: dia } : {}) })),
  };
}
