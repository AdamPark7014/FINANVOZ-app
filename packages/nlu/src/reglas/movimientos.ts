/**
 * Movimientos del nivel 0 que no son un gasto simple (docs/06-NLU.md §9): ingresos, retiros, transferencias, pagos de
 * tarjeta, préstamos, tandas, compras a meses, cuentas divididas y el espacio negocio. Cada producción consume la
 * frase completa o devuelve `null`.
 */
import type { Centavos } from '@cartera/core';
import type { Interpretacion, Movimiento, RefCuenta } from '../esquema';
import { type Desc, leerDesc } from './desc';
import type { Entorno } from './entorno';
import { leerFechaRegistro } from './fechas';
import { Lector } from './lector';
import { leerEntero, leerMonto } from './montos';
import { ARTICULOS, SEP, type Tokens, recortar } from './tokens';
import { leerGastoSimple, VERBOS } from './gasto';

const FUERON: readonly (readonly string[])[] = [
  ['fueron'],
  ['fue'],
  ['son'],
  ['es'],
  ['me', 'dieron'],
  ['de'],
];
const CLAUSULA_ME_DEBIA: readonly (readonly string[])[] = [
  ['de', 'lo', 'que', 'le', 'preste'],
  ['que', 'le', 'preste'],
  ['que', 'le', 'habia', 'prestado'],
  ['de', 'lo', 'que', 'me', 'debia'],
  ['que', 'me', 'debia'],
  ['de', 'lo', 'que', 'me', 'debe'],
  ['que', 'me', 'debe'],
];
const CLAUSULA_ME_PRESTO: readonly (readonly string[])[] = [
  ['de', 'lo', 'que', 'me', 'presto'],
  ['que', 'me', 'presto'],
  ['que', 'me', 'habia', 'prestado'],
  ['de', 'lo', 'que', 'le', 'debia'],
  ['que', 'le', 'debia'],
  ['de', 'lo', 'que', 'le', 'debo'],
  ['que', 'le', 'debo'],
];
const EN_LA_TIENDA: readonly (readonly string[])[] = [
  ['en', 'la', 'tienda'],
  ['en', 'el', 'negocio'],
  ['en', 'el', 'local'],
];
const DE_LA_CAJA: readonly (readonly string[])[] = [
  ['de', 'la', 'caja'],
  ['de', 'la', 'tienda'],
  ['del', 'negocio'],
];
/** Lo que se cobra como trabajo propio: "me pagaron 3,500 por un diseño" es honorarios, no venta ni cobro. */
const TRABAJOS: readonly string[] = [
  'trabajo',
  'trabajito',
  'chamba',
  'chambita',
  'jale',
  'diseño',
  'diseños',
  'proyecto',
  'logo',
  'clase',
  'clases',
  'asesoria',
  'asesorias',
  'consultoria',
  'tutoria',
  'servicio',
  'traduccion',
  'reparacion',
  'arreglo',
  'sesion',
];
/** "… y Caro y Juan me deben su parte": quienes deben su parte de una cuenta que pagó el usuario. */
const DEBEN_SU_PARTE: readonly (readonly string[])[] = [
  ['me', 'deben', 'su', 'parte'],
  ['me', 'debe', 'su', 'parte'],
];

type Resultado = Interpretacion | null;

const registrar = (movimiento: Movimiento): Interpretacion => ({
  intencion: 'registrar',
  movimientos: [movimiento],
});

/** Monto > 0 en el cursor, o `null`. */
function monto(l: Lector): LecturaPositiva | null {
  const lectura = leerMonto(l);
  return lectura && lectura.monto > 0 ? lectura : null;
}
interface LecturaPositiva {
  monto: Centavos;
  aproximado: boolean;
}

/** `[,] (fueron|fue|son|me dieron)? MONTO` al final de la frase. */
function montoFinal(l: Lector): LecturaPositiva | null {
  const inicio = l.marca();
  l.sep();
  l.alguna(...FUERON);
  const lectura = monto(l);
  if (lectura && l.fin) return lectura;
  l.volver(inicio);
  return null;
}

/** Fecha relativa opcional al inicio y el cuerpo que sigue. */
function conFecha(tokens: Tokens, env: Entorno): { l: Lector; fecha: string } {
  const l = new Lector(tokens);
  const fecha = leerFechaRegistro(l, env.hoy);
  if (fecha !== null) l.sep();
  return { l, fecha: fecha ?? env.hoy };
}

/**
 * INGRESO := me cayó la quincena [,] MONTO                        (sueldo)
 *          | me depositaron la quincena [en ALIAS_DEB] [,] MONTO   (sueldo, débito)
 *          | me depositaron MONTO [en ALIAS_DEB]                   (débito)
 *          | [PERSONA] me regaló MONTO | me regalaron MONTO        (regalo_recibido)
 *          | me reembolsaron MONTO [de|por TEXTO] [a|en ALIAS_DEB] (reembolso)
 *          | [me cayeron|me depositaron|me pagaron|me llegaron] [los] rendimientos [de TEXTO] [,] MONTO
 *          | vendí MONTO [en la tienda]                            (ventas, negocio; solo con negocio activo)
 *          | vendí [art] TEXTO (en|por) MONTO [, me pagaron METODO] (ventas, personal)
 */
export function ingreso(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  const base = (m: LecturaPositiva, extra: Partial<Movimiento>): Interpretacion =>
    registrar({
      tipo: 'ingreso',
      monto: m.monto,
      fecha,
      ...(m.aproximado ? { aproximado: true } : {}),
      ...extra,
    });
  const inicio = l.marca();

  if (l.secuencia('me', 'cayo', 'la', 'quincena')) {
    const m = montoFinal(l);
    return m ? base(m, { categoria: 'sueldo' }) : null;
  }
  l.volver(inicio);
  if (l.secuencia('me', 'depositaron')) {
    if (l.secuencia('la', 'quincena')) {
      let destino: RefCuenta = { tipo: 'debito' };
      if (l.palabra('en')) {
        const ref = env.alias(l, ['debito']);
        if (!ref) return null;
        destino = ref;
      }
      const m = montoFinal(l);
      return m ? base(m, { categoria: 'sueldo', destino }) : null;
    }
    const m = monto(l);
    if (!m) return null;
    let destino: RefCuenta = { tipo: 'debito' };
    if (l.palabra('en', 'a')) {
      const ref = env.alias(l, ['debito']);
      if (!ref) return null;
      destino = ref;
    }
    return l.fin ? base(m, { destino }) : null;
  }
  l.volver(inicio);
  if (l.secuencia('me', 'regalaron')) {
    const m = monto(l);
    return m && l.fin ? base(m, { categoria: 'regalo_recibido' }) : null;
  }
  l.volver(inicio);
  {
    const persona = env.persona(l);
    if (persona && l.secuencia('me', 'regalo')) {
      const m = monto(l);
      return m && l.fin ? base(m, { categoria: 'regalo_recibido' }) : null;
    }
  }
  l.volver(inicio);
  if (l.secuencia('me', 'reembolsaron')) {
    const m = monto(l);
    if (!m) return null;
    if (l.palabra('de', 'por') && !textoLibre(l, env, ['a', 'en'])) return null;
    let destino: RefCuenta | undefined;
    if (l.palabra('a', 'en')) {
      const ref = env.alias(l, ['debito']);
      if (!ref) return null;
      destino = ref;
    }
    return l.fin ? base(m, { categoria: 'reembolso', ...(destino ? { destino } : {}) }) : null;
  }
  l.volver(inicio);
  if (
    l.alguna(['me', 'cayeron'], ['me', 'depositaron'], ['me', 'pagaron'], ['me', 'llegaron']) ||
    l.ver() === 'los' ||
    l.ver() === 'rendimientos'
  ) {
    l.palabra('los');
    if (l.palabra('rendimientos')) {
      if (l.palabra('de', 'del') && !textoLibre(l, env, [SEP, 'fueron', 'fue', 'son'])) return null;
      const m = montoFinal(l);
      return m ? base(m, { categoria: 'rendimientos' }) : null;
    }
  }
  // me pagaron MONTO por [art|mi] TRABAJO [de|del|para TEXTO] [METODO] → honorarios (I03). "Me pagaron 300" a secas
  // (ingreso o cobro de un préstamo) o "por la bici" (venta) siguen en la nube.
  l.volver(inicio);
  if (l.secuencia('me', 'pagaron')) {
    const m = monto(l);
    if (m && l.palabra('por')) {
      l.palabra('un', 'una', 'el', 'la', 'unos', 'unas', 'los', 'las', 'mi', 'mis');
      if (l.palabra(...TRABAJOS)) {
        const conTexto = !l.palabra('de', 'del', 'para') || textoLibre(l, env, ['en', 'con', 'por', SEP]);
        l.sep();
        const destino = env.metodo(l);
        if (conTexto && l.fin) {
          return base(m, { categoria: 'honorarios', ...(destino ? { destino } : {}) });
        }
      }
    }
  }
  l.volver(inicio);
  if (l.palabra('vendi')) {
    const despuesDeVendi = l.marca();
    const m = monto(l);
    if (m) {
      if (!env.negocio) return null;
      l.alguna(...EN_LA_TIENDA);
      return l.fin ? base(m, { categoria: 'ventas', espacio: 'negocio' }) : null;
    }
    l.volver(despuesDeVendi);
    if (!l.palabra('mi', 'el', 'la', 'un', 'una', 'unos', 'unas')) return null;
    if (!textoLibre(l, env, ['en', 'por'])) return null;
    if (!l.palabra('en', 'por')) return null;
    const precio = monto(l);
    if (!precio) return null;
    let destino: RefCuenta | undefined;
    if (l.sep() || l.ver() === 'me') {
      if (!l.alguna(['me', 'pagaron'], ['me', 'lo', 'pagaron'], ['me', 'la', 'pagaron'])) return null;
      const ref = env.metodo(l);
      if (!ref) return null;
      destino = ref;
    }
    return l.fin ? base(precio, { categoria: 'ventas', ...(destino ? { destino } : {}) }) : null;
  }
  return null;
}

/** 1 a 6 palabras libres (sin fechas, pagos, deudas, negocio, alias ni dígitos) hasta el final o hasta `hastaAntesDe`. */
function textoLibre(l: Lector, env: Entorno, hastaAntesDe: readonly string[] = []): boolean {
  const inicio = l.marca();
  let n = 0;
  while (!l.fin && n < 6) {
    const p = l.ver() ?? '';
    if (hastaAntesDe.includes(p)) break;
    if (!env.palabraLibre(p) || env.nombres.has(p)) {
      l.volver(inicio);
      return false;
    }
    l.pos++;
    n++;
  }
  if (n >= 1 && (l.fin || hastaAntesDe.includes(l.ver() ?? ''))) return true;
  l.volver(inicio);
  return false;
}

/**
 * RETIRO := (saqué|retiré) MONTO del cajero [con [la] ALIAS]
 *         | (saqué|retiré) MONTO (de|del) [la|mi] ALIAS_NO_EFECTIVO [(en|del) [el] cajero]
 *         | (saqué|retiré) MONTO con [la|mi] ALIAS_NO_EFECTIVO (en|del) [el] cajero
 * RETIRO_DUEÑO := (saqué|me pagué) MONTO (de la caja|de la tienda|del negocio) para mí   (solo con negocio)
 */
export function retiro(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  const esDueno = l.secuencia('me', 'pague');
  if (!esDueno && !l.palabra('saque', 'retire')) return null;
  const m = monto(l);
  if (!m) return null;
  const despuesDelMonto = l.marca();
  const aprox = m.aproximado ? { aproximado: true as const } : {};

  // Retiro del dueño.
  if (env.negocio) {
    for (const forma of DE_LA_CAJA) {
      l.volver(despuesDelMonto);
      if (!l.secuencia(...forma)) continue;
      const alias = new Lector({ t: forma.slice(-1), o: forma.slice(-1), c: forma.slice(-1) });
      const origen = env.alias(alias);
      if (origen && l.secuencia('para', 'mi') && l.fin) {
        return registrar({ tipo: 'retiro_dueno', monto: m.monto, fecha, origen, ...aprox });
      }
    }
  }
  if (esDueno) return null;

  const retiroEfectivo = (origen: RefCuenta): Interpretacion =>
    registrar({
      tipo: 'retiro_efectivo',
      monto: m.monto,
      fecha,
      origen,
      destino: { tipo: 'efectivo' },
      ...aprox,
    });
  const cajero = () => l.alguna(['del', 'cajero'], ['en', 'el', 'cajero'], ['en', 'cajero']);
  l.volver(despuesDelMonto);
  if (cajero()) {
    if (l.fin) return retiroEfectivo({ tipo: 'debito' });
    if (!l.palabra('con')) return null;
    const ref = env.alias(l, ['debito', 'credito']);
    return ref && l.fin ? retiroEfectivo(ref) : null;
  }
  l.volver(despuesDelMonto);
  if (l.palabra('de', 'del', 'con')) {
    const conector = l.t[l.pos - 1];
    const ref = env.alias(l, ['debito', 'credito']);
    if (!ref) return null;
    const hayCajero = cajero();
    if (conector === 'con' && !hayCajero) return null;
    return l.fin ? retiroEfectivo(ref) : null;
  }
  return null;
}

/**
 * TRANSFERENCIA := (pasé|transferí|moví|mandé) MONTO (de|del) [la|mi] ALIAS_A (a|al) [la|mi] ALIAS_B
 *                | deposité [MONTO] [en] efectivo [MONTO] (a|en) [mi cuenta de|la|mi] ALIAS_DEB
 * Solo entre cuentas propias; ninguna de crédito.
 */
export function transferencia(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  const mover = (m: LecturaPositiva, origen: RefCuenta, destino: RefCuenta): Interpretacion =>
    registrar({
      tipo: 'transferencia',
      monto: m.monto,
      fecha,
      origen,
      destino,
      ...(m.aproximado ? { aproximado: true } : {}),
    });
  if (l.palabra('pase', 'transferi', 'movi', 'mande')) {
    const m = monto(l);
    if (!m || !l.palabra('de', 'del')) return null;
    const origen = env.alias(l, ['debito', 'efectivo']);
    if (!origen || !l.palabra('a', 'al')) return null;
    const destino = env.alias(l, ['debito', 'efectivo']);
    if (!destino || !l.fin || origen.alias === destino.alias) return null;
    return mover(m, origen, destino);
  }
  if (l.palabra('deposite')) {
    let m = monto(l);
    l.palabra('en');
    if (!l.palabra('efectivo', 'cash', 'billetes')) return null;
    if (!m) m = monto(l);
    if (!m || !l.palabra('a', 'en')) return null;
    const destino = env.alias(l, ['debito']);
    return destino && l.fin ? mover(m, { tipo: 'efectivo' }, destino) : null;
  }
  return null;
}

/**
 * PAGO_TDC := pagué MONTO (de|a) [la|mi] [tarjeta] ALIAS_CRED [ORIGEN]
 *           | (pagué|liquidé|aboné) [el mínimo de|el total de] [la|mi] [tarjeta] ALIAS_CRED [ORIGEN] [,] [fueron] MONTO
 * ORIGEN := (desde|con|de) [la|mi] [cuenta de] ALIAS_NO_CRED | con|en efectivo | por transferencia
 */
export function pagoTarjeta(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  if (!l.palabra('pague', 'liquide', 'abone')) return null;
  const pago = (m: LecturaPositiva, destino: RefCuenta, origen: RefCuenta | undefined): Interpretacion =>
    registrar({
      tipo: 'pago_tarjeta',
      monto: m.monto,
      fecha,
      origen: origen ?? { tipo: 'desconocido' },
      destino,
      ...(m.aproximado ? { aproximado: true } : {}),
    });
  const origenPago = (): RefCuenta | null | undefined => {
    const inicio = l.marca();
    if (l.palabra('desde', 'con', 'de')) {
      const conector = l.t[l.pos - 1];
      if (conector === 'con' && l.palabra('efectivo', 'cash')) return { tipo: 'efectivo' };
      const ref = env.alias(l, ['debito', 'efectivo']);
      if (ref) return ref;
      l.volver(inicio);
      return null;
    }
    if (l.secuencia('en', 'efectivo')) return { tipo: 'efectivo' };
    if (l.secuencia('por', 'transferencia')) return { tipo: 'debito' };
    return undefined;
  };
  const inicio = l.marca();
  const primero = monto(l);
  if (primero && l.t[inicio - 1] === 'pague') {
    if (!l.palabra('de', 'a')) return null;
    l.palabra('la', 'mi');
    l.palabra('tarjeta');
    const destino = env.alias(l, ['credito']);
    if (!destino) return null;
    const origen = origenPago();
    if (origen === null) return null;
    return l.fin ? pago(primero, destino, origen) : null;
  }
  l.volver(inicio);
  l.alguna(['el', 'minimo', 'de'], ['el', 'total', 'de'], ['todo', 'de']);
  const destino = env.alias(l, ['credito']);
  if (!destino) return null;
  const origen = origenPago();
  if (origen === null) return null;
  const m = montoFinal(l);
  return m ? pago(m, destino, origen) : null;
}

/**
 * PRESTAMO_OTORGADO := le (presté|fié) MONTO a PERSONA
 * COBRO_PRESTAMO    := PERSONA [ya] me (regresó|devolvió) [los|las] MONTO [CLAUSULA]
 *                    | PERSONA [ya] me (pagó|depositó) [los|las] MONTO CLAUSULA   (depositó → destino débito)
 * PRESTAMO_RECIBIDO := PERSONA me prestó MONTO
 * PAGO_PRESTAMO     := le pagué [a PERSONA] MONTO [a PERSONA] CLAUSULA_PRESTO
 * Un cliente del fiado o "fié" (con negocio activo) ponen `espacio: 'negocio'`.
 */
export function prestamos(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  const movimiento = (
    tipo: Movimiento['tipo'],
    m: LecturaPositiva,
    contraparte: string,
    negocio: boolean,
    extra: Partial<Movimiento> = {},
  ): Interpretacion =>
    registrar({
      tipo,
      monto: m.monto,
      fecha,
      contraparte,
      ...(negocio ? { espacio: 'negocio' } : {}),
      ...(m.aproximado ? { aproximado: true } : {}),
      ...extra,
    });
  const inicio = l.marca();

  if (l.palabra('le')) {
    if (l.palabra('preste', 'fie')) {
      const fie = l.t[l.pos - 1] === 'fie';
      const m = monto(l);
      if (!m || !l.palabra('a')) return null;
      const persona = env.persona(l);
      if (!persona || !l.fin) return null;
      return movimiento('prestamo_otorgado', m, persona.contraparte, env.negocio && (fie || persona.cliente));
    }
    if (l.palabra('pague')) {
      let persona = l.palabra('a') ? env.persona(l) : null;
      const m = monto(l);
      if (!m) return null;
      if (!persona && l.palabra('a')) persona = env.persona(l);
      if (!persona || !l.alguna(...CLAUSULA_ME_PRESTO) || !l.fin) return null;
      return movimiento('pago_prestamo', m, persona.contraparte, env.negocio && persona.cliente);
    }
    // DAR := le (di|pasé|mandé|deposité|transferí) MONTO (a|al) PERSONA [METODO] → gasto con contraparte (06 §3.1:
    // darle dinero a alguien sin decir préstamo). Un familiar → apoyo_familiar. A un cliente del fiado puede ser
    // fiado: lo decide la nube.
    if (l.palabra('di', 'pase', 'mande', 'deposite', 'transferi')) {
      const m = monto(l);
      if (!m || !l.palabra('a', 'al')) return null;
      const persona = env.persona(l);
      if (!persona || persona.cliente) return null;
      const origen = env.metodo(l) ?? { tipo: 'desconocido' as const };
      if (!l.fin) return null;
      return registrar({
        tipo: 'gasto',
        monto: m.monto,
        fecha,
        ...(env.esFamiliar(persona.contraparte) ? { categoria: 'apoyo_familiar' as const } : {}),
        contraparte: persona.contraparte,
        origen,
        ...(m.aproximado ? { aproximado: true } : {}),
      });
    }
    return null;
  }
  l.volver(inicio);
  const persona = env.persona(l);
  if (!persona) return null;
  l.palabra('ya');
  if (!l.palabra('me')) return null;
  if (l.palabra('presto')) {
    const m = monto(l);
    return m && l.fin
      ? movimiento('prestamo_recibido', m, persona.contraparte, env.negocio && persona.cliente)
      : null;
  }
  const verboCobro = l.ver();
  if (verboCobro === undefined || !['regreso', 'devolvio', 'pago', 'deposito'].includes(verboCobro))
    return null;
  l.pos++;
  l.palabra('los', 'las');
  const m = monto(l);
  if (!m) return null;
  const clausula = l.alguna(...CLAUSULA_ME_DEBIA);
  if (!l.fin) return null;
  if ((verboCobro === 'pago' || verboCobro === 'deposito') && !clausula) return null;
  return movimiento(
    'cobro_prestamo',
    m,
    persona.contraparte,
    env.negocio && persona.cliente,
    verboCobro === 'deposito' ? { destino: { tipo: 'debito' } } : {},
  );
}

/**
 * TANDA_APORTE := (di|pagué|aboné|puse|deposité) [mi|la] tanda [METODO] [,] MONTO
 *               | (di|pagué) MONTO (de|a) [mi|la] tanda [METODO]
 * TANDA_COBRO  := [ya] me tocó la tanda [,] [me dieron|fueron] MONTO [METODO_DESTINO] | cobré la tanda [,] MONTO
 */
export function tanda(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  const inicio = l.marca();
  const movimiento = (
    tipo: 'aportacion_tanda' | 'cobro_tanda',
    m: LecturaPositiva,
    cuenta?: RefCuenta,
  ): Interpretacion =>
    registrar({
      tipo,
      monto: m.monto,
      fecha,
      ...(cuenta && tipo === 'aportacion_tanda' ? { origen: cuenta } : {}),
      ...(cuenta && tipo === 'cobro_tanda' ? { destino: cuenta } : {}),
      ...(m.aproximado ? { aproximado: true } : {}),
    });
  if (l.palabra('di', 'pague', 'abone', 'puse', 'deposite')) {
    const verbo = l.t[l.pos - 1];
    const despues = l.marca();
    if (l.palabra('mi', 'la') && l.palabra('tanda')) {
      const origen = env.metodo(l) ?? undefined;
      const m = montoFinal(l);
      return m ? movimiento('aportacion_tanda', m, origen) : null;
    }
    l.volver(despues);
    if (verbo !== 'di' && verbo !== 'pague') return null;
    const m = monto(l);
    if (!m || !l.palabra('de', 'a') || !l.palabra('mi', 'la') || !l.palabra('tanda')) return null;
    const origen = env.metodo(l) ?? undefined;
    return l.fin ? movimiento('aportacion_tanda', m, origen) : null;
  }
  l.volver(inicio);
  l.palabra('ya');
  if (l.secuencia('me', 'toco', 'la', 'tanda') || l.secuencia('cobre', 'la', 'tanda')) {
    l.sep();
    l.alguna(['me', 'dieron'], ['fueron'], ['fue'], ['son']);
    const m = monto(l);
    if (!m) return null;
    const destino = env.metodo(l) ?? undefined;
    return l.fin ? movimiento('cobro_tanda', m, destino) : null;
  }
  return null;
}

/**
 * MSI := [VERBO|saqué] [art] DESC (de|por) MONTO a N (meses|msi) [sin intereses] [METODO_CRED]
 *      | [VERBO|saqué] [art] DESC a N (meses|msi) [sin intereses] [METODO_CRED] [,] MONTO
 * Sin verbo, la DESC debe ser conocida o llevar artículo. Origen: la tarjeta dicha o `credito` sin alias.
 */
export function compraMsi(tokens: Tokens, env: Entorno): Resultado {
  const { l, fecha } = conFecha(tokens, env);
  let conVerbo = false;
  const verbo = [...VERBOS, ['saque']].find((v) => v.every((p, k) => l.ver(k) === p));
  if (verbo) {
    l.pos += verbo.length;
    conVerbo = true;
  }
  const inicioDesc = l.marca();
  const conArticulo = ARTICULOS.has(l.ver() ?? '');
  // La DESC termina donde empieza "de MONTO a N meses" o "a N meses".
  for (let finDesc = inicioDesc + 1; finDesc < l.largo; finDesc++) {
    l.volver(finDesc);
    let precio: LecturaPositiva | null = null;
    if (l.palabra('de', 'por')) {
      precio = monto(l);
      if (!precio) continue;
    }
    if (!l.palabra('a')) continue;
    const meses = leerEntero(l, 48);
    if (meses === null || meses < 2 || !l.palabra('meses', 'msi')) continue;
    l.alguna(['sin', 'intereses'], ['msi']);
    let origen: RefCuenta = { tipo: 'credito' };
    if (l.palabra('con')) {
      const ref =
        env.alias(l, ['credito']) ??
        (l.secuencia('la', 'de', 'credito') ? { tipo: 'credito' as const } : null);
      if (!ref) return null;
      origen = ref;
    }
    if (!precio) {
      precio = montoFinal(l);
      if (!precio) return null;
    }
    if (!l.fin) return null;
    const desc = leerDesc(tokens, inicioDesc, finDesc, env, { conocida: !conVerbo && !conArticulo });
    if (!desc || desc.espacio) return null;
    return registrar({
      tipo: 'compra_msi',
      monto: precio.monto,
      fecha,
      descripcion: desc.descripcion,
      ...(desc.categoria ? { categoria: desc.categoria } : {}),
      origen,
      msi: { meses },
      ...(precio.aproximado ? { aproximado: true } : {}),
    });
  }
  return null;
}

/** PERSONA ((y|,) PERSONA)* en todo `tokens` (sin clientes): los que deben su parte. */
function listaDePersonas(tokens: Tokens, env: Entorno): string[] | null {
  const l = new Lector(tokens);
  const nombres: string[] = [];
  for (;;) {
    const persona = env.persona(l);
    if (!persona || persona.cliente) return null;
    nombres.push(persona.contraparte);
    if (l.fin) return nombres;
    const separado = l.sep();
    if (!l.palabra('y') && !separado) return null;
  }
}

/**
 * DIVIDIDA_DEUDORES := [FECHA] GASTO [,] [y] PERSONA ((y|,) PERSONA)* (me deben|me debe) su parte   (D03)
 * El gasto lo pagó el usuario; `partes` = los nombrados + el usuario (06 §3.1: "Ana y Beto me deben su parte" → 3).
 */
function divididaConDeudores(tokens: Tokens, env: Entorno): Resultado {
  const t = tokens.t;
  for (const cola of DEBEN_SU_PARTE) {
    const finPersonas = t.length - cola.length;
    if (finPersonas < 3 || !cola.every((p, k) => t[finPersonas + k] === p)) continue;
    for (let desde = 2; desde < finPersonas; desde++) {
      if (t[desde - 1] !== SEP && t[desde - 1] !== 'y') continue;
      const participantes = listaDePersonas(recortar(tokens, desde, finPersonas), env);
      if (!participantes) continue;
      let finGasto = desde - 1;
      if (t[finGasto - 1] === SEP && t[finGasto] === 'y') finGasto--;
      const { l, fecha } = conFecha(recortar(tokens, 0, finGasto), env);
      const gasto = leerGastoSimple(recortar(l.tokens, l.pos, l.largo), env);
      if (!gasto || gasto.desc?.espacio) continue;
      return registrar({
        tipo: 'cuenta_dividida',
        monto: gasto.monto,
        fecha,
        ...(gasto.desc ? { descripcion: gasto.desc.descripcion } : {}),
        ...(gasto.desc?.categoria ? { categoria: gasto.desc.categoria } : {}),
        origen: gasto.origen ?? { tipo: 'desconocido' },
        division: { partes: participantes.length + 1, participantes },
        ...(gasto.aproximado ? { aproximado: true } : {}),
      });
    }
  }
  return null;
}

/** "la cuenta" de un restaurante: en una cuenta dividida no es una cuenta de banco. */
const esLaCuenta = (palabras: readonly string[]) =>
  palabras.join(' ') === 'la cuenta' || palabras.join(' ') === 'cuenta';

/**
 * DIVIDIDA := [yo] (VERBO|dividimos) [art] DESC [(de|por|,) MONTO] entre (N | todos [,] (éramos|fuimos|somos) N) [,]
 *             [yo pagué MONTO] [METODO]
 *           | DIVIDIDA_DEUDORES
 * `partes` cuenta al usuario; exactamente un monto.
 */
export function cuentaDividida(tokens: Tokens, env: Entorno): Resultado {
  const conDeudores = divididaConDeudores(tokens, env);
  if (conDeudores) return conDeudores;
  const { l, fecha } = conFecha(tokens, env);
  l.palabra('yo');
  const verbo = [...VERBOS, ['dividimos']].find((v) => v.every((p, k) => l.ver(k) === p));
  if (!verbo) return null;
  l.pos += verbo.length;
  const inicioDesc = l.marca();
  for (let finDesc = inicioDesc + 1; finDesc < l.largo; finDesc++) {
    l.volver(finDesc);
    let total: LecturaPositiva | null = null;
    if (l.palabra('de', 'por')) {
      total = monto(l);
      if (!total) continue;
    } else if (l.sep()) {
      // "yo pagué la cuenta, 1,800 entre todos": el monto tras la coma.
      total = monto(l);
      if (!total) continue;
    }
    if (!l.palabra('entre')) continue;
    let partes = leerEntero(l, 50);
    if (partes === null) {
      // "entre todos, éramos 6": sin el número no se adivina.
      if (!l.palabra('todos')) return null;
      l.sep();
      l.palabra('y');
      if (!l.palabra('eramos', 'fuimos', 'somos')) return null;
      partes = leerEntero(l, 50);
    }
    if (partes === null || partes < 2) return null;
    l.sep();
    if (l.secuencia('yo', 'pague')) {
      if (total) return null;
      total = monto(l);
      if (!total) return null;
    }
    const origen = env.metodo(l) ?? { tipo: 'desconocido' as const };
    if (!total || !l.fin) return null;
    const desc: Desc | null = esLaCuenta(tokens.t.slice(inicioDesc, finDesc))
      ? { descripcion: 'cuenta' }
      : leerDesc(tokens, inicioDesc, finDesc, env, { conocida: false });
    if (!desc || desc.espacio) return null;
    return registrar({
      tipo: 'cuenta_dividida',
      monto: total.monto,
      fecha,
      descripcion: desc.descripcion,
      ...(desc.categoria ? { categoria: desc.categoria } : {}),
      origen,
      division: { partes },
      ...(total.aproximado ? { aproximado: true } : {}),
    });
  }
  return null;
}
