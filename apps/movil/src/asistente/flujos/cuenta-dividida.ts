import { ErrorDominio } from '@cartera/core';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { normalizarAlias } from '@cartera/nlu';
import { cuentaPorId, cuentasPropias, idCategoriaDe } from '../../servicios/catalogo';
import { enTransaccion, type Contexto } from '../../servicios/contexto';
import {
  MAX_PARTES,
  personasConAlias,
  repartoCuentaDividida,
  type PersonaConAlias,
} from '../../servicios/cuenta-dividida';
import { crearPersona } from '../../servicios/personas';
import {
  confirmarCuentaDividida,
  type CuentaPorElegir,
  type PropuestaCuentaDividida,
} from '../../servicios/registrar';
import { formatearCentavos } from '../../ui/formato';
import type { FilaEntendi } from '../../ui/entendi';
import type { ChipRespuesta, PasoFlujo } from '../tipos';
import {
  comoContexto,
  conCambioDia,
  desenvolver,
  elegir,
  filaTocable,
  leerEntero,
  mayuscula,
  opcion,
  resultadoDe,
} from './comun';
import type { FlujoConversacional } from './contrato';
import { dejarPrellenado } from './prellenado';
import * as T from './textos';

/**
 * Cuenta dividida (Ola 7 §6): desde `confirmar_division` de `registrarTexto` («pagué la cena de 1,200 entre 4 con la
 * Nu»). Pregunta solo lo que falte (entre cuántos, con qué pagaste, quiénes: chips de contactos o un nombre nuevo)
 * → «Entendí» con tu parte y la de cada persona (`repartoCuentaDividida`, E12.1) → `confirmarCuentaDividida`.
 * Los nombres dichos que no son de ningún contacto se agregan como contactos al confirmar (la tarjeta lo dice).
 */

interface Opcion {
  readonly id: string;
  readonly nombre: string;
}

export interface EstadoDivision {
  readonly porVoz: boolean;
  readonly propuesta: PropuestaCuentaDividida;
  readonly partes: number | null;
  readonly origenId: string | null;
  /** La cuenta que ya venía elegida (dicha o el único parecido). */
  readonly preelegida: string | null;
  /** Contactos elegidos, en orden (uno por parte ajena). */
  readonly personaIds: readonly string[];
  /** Nombres que no son de ningún contacto: se agregan al confirmar. */
  readonly porAgregar: readonly string[];
  /** Nombres que coinciden con varios contactos: «¿Quién es Ana?». */
  readonly porAclarar: readonly { readonly nombre: string; readonly candidatas: readonly Opcion[] }[];
  /** Cuántos nombres ya se aclararon (numera las preguntas «¿Quién es…?»). */
  readonly aclarados: number;
  readonly personas: readonly PersonaConAlias[];
  /** Con qué pudo pagar (cuentas propias y, si se dictó sin método, «Todavía no sé»). */
  readonly cuentas: readonly Opcion[];
}

const nombradas = (e: EstadoDivision): number =>
  e.personaIds.length + e.porAgregar.length + e.porAclarar.length;
const minimoPartes = (e: EstadoDivision): number => Math.max(2, nombradas(e) + 1);

/** A quién se refiere un nombre dicho: un contacto, varios (hay que aclarar) o nadie (contacto nuevo). */
function clasificar(e: EstadoDivision, nombre: string): EstadoDivision {
  const n = normalizarAlias(nombre);
  const coinciden = e.personas.filter((p) => p.alias.includes(n));
  const [unica] = coinciden;
  if (coinciden.length === 1 && unica) return { ...e, personaIds: [...e.personaIds, unica.cuentaId] };
  if (coinciden.length > 1) {
    return {
      ...e,
      porAclarar: [
        ...e.porAclarar,
        { nombre, candidatas: coinciden.map((p) => ({ id: p.cuentaId, nombre: p.nombre })) },
      ],
    };
  }
  return { ...e, porAgregar: [...e.porAgregar, mayuscula(nombre.trim())] };
}

function chipsOrigen(e: EstadoDivision): ChipRespuesta[] {
  const f = e.propuesta.faltaOrigen;
  const lista = f && f.candidatas.length > 0 ? f.candidatas : e.cuentas;
  return lista.map((c) => ({ valor: c.id, etiqueta: c.nombre }));
}

function chipsPersona(e: EstadoDivision): ChipRespuesta[] {
  return e.personas
    .filter((p) => !e.personaIds.includes(p.cuentaId))
    .map((p) => ({ valor: p.cuentaId, etiqueta: p.nombre }));
}

const NUEVA = 'nueva';

function aliasPorAprender(e: EstadoDivision): string | null {
  const f: Omit<CuentaPorElegir, 'campo'> | null = e.propuesta.faltaOrigen;
  return f && f.motivo !== 'ambigua' && f.alias && e.origenId && e.origenId !== e.preelegida ? f.alias : null;
}

function queFue(ctx: Contexto, p: PropuestaCuentaDividida): string {
  if (p.descripcion) return p.descripcion;
  try {
    return cuentaPorId(ctx, idCategoriaDe(ctx, p.categoria, 'gasto')).nombre;
  } catch {
    return '';
  }
}

const pasos: readonly PasoFlujo<EstadoDivision>[] = [
  {
    id: 'partes',
    pregunta: () => T.PREGUNTA_PARTES,
    campo: 'texto',
    chips: (e) =>
      Array.from({ length: 5 }, (_, i) => minimoPartes(e) + i).map((n) => ({
        valor: String(n),
        etiqueta: String(n),
      })),
    omitirSi: (e) => e.partes !== null,
    aplicar: (e, r) => {
      const minimo = minimoPartes(e);
      const n = leerEntero(r, minimo, MAX_PARTES);
      return n === null ? { error: T.errorPartes(minimo) } : { ...e, partes: n };
    },
  },
  {
    id: 'origen',
    pregunta: (e) => {
      const f = e.propuesta.faltaOrigen;
      return f?.motivo === 'no_encontrada' && f.alias
        ? T.preguntaCuentaNoEncontrada(f.alias)
        : T.PREGUNTA_PAGASTE_CON;
    },
    chips: chipsOrigen,
    omitirSi: (e) => e.origenId !== null,
    aplicar: (e, r) => {
      const v = elegir(r, chipsOrigen(e));
      return v === null ? { error: T.ERROR_ELEGIR } : { ...e, origenId: v };
    },
  },
  // Una pregunta por nombre que aclarar y una por persona que falte, cada una con su id (`quien-1`, `persona-2`…):
  // así ningún paso se repite y la pantalla puede dar por contestado cada uno.
  ...Array.from({ length: MAX_PARTES - 1 }, (_, i) => pasoQuien(i + 1)),
  ...Array.from({ length: MAX_PARTES - 1 }, (_, i) => pasoPersona(i + 1)),
];

function chipsQuien(actual: EstadoDivision['porAclarar'][number] | undefined): ChipRespuesta[] {
  return [
    ...(actual?.candidatas ?? []).map((c) => ({ valor: c.id, etiqueta: c.nombre })),
    { valor: NUEVA, etiqueta: T.chipAlguienNuevo(actual?.nombre ?? '') },
  ];
}

/** «¿Quién es «Ana»?» (la k-ésima aclaración): un contacto de los que coinciden o alguien nuevo. */
function pasoQuien(k: number): PasoFlujo<EstadoDivision> {
  return {
    id: `quien-${k}`,
    pregunta: (e) => T.preguntaQuienEs(e.porAclarar[0]?.nombre ?? ''),
    chips: (e) => chipsQuien(e.porAclarar[0]),
    omitirSi: (e) => e.porAclarar.length === 0 || e.aclarados !== k - 1,
    aplicar: (e, r) => {
      const [actual, ...resto] = e.porAclarar;
      if (!actual) return { error: T.ERROR_PASO };
      const v = elegir(r, chipsQuien(actual));
      if (v === null) return { error: T.ERROR_ELEGIR };
      const comun = { ...e, porAclarar: resto, aclarados: e.aclarados + 1 };
      return v === NUEVA
        ? { ...comun, porAgregar: [...e.porAgregar, mayuscula(actual.nombre.trim())] }
        : { ...comun, personaIds: [...e.personaIds, v] };
    },
  };
}

/** «¿Con quién fue?» por la k-ésima persona (contándolas desde las que ya se nombraron). */
function pasoPersona(k: number): PasoFlujo<EstadoDivision> {
  return {
    id: `persona-${k}`,
    pregunta: (e) => T.preguntaPersona((e.partes ?? 2) - 1 - nombradas(e)),
    ayuda: () => T.AYUDA_PERSONA,
    campo: 'texto',
    chips: chipsPersona,
    omitirSi: (e) => e.partes === null || nombradas(e) >= e.partes - 1 || nombradas(e) !== k - 1,
    aplicar: (e, r) => {
      if (r.tipo === 'chip') {
        const v = elegir(r, chipsPersona(e));
        return v === null ? { error: T.ERROR_PERSONA } : { ...e, personaIds: [...e.personaIds, v] };
      }
      if (r.tipo !== 'texto') return { error: T.ERROR_PERSONA };
      const limpio = r.texto.trim();
      if (normalizarAlias(limpio) === '' || limpio.length > 80) return { error: T.ERROR_PERSONA };
      return clasificar(e, limpio);
    },
  };
}

/** Personas en el orden en que quedarán en el libro: contactos elegidos y después los nuevos. */
function nombresEnOrden(e: EstadoDivision): { nombre: string; nueva: boolean }[] {
  return [
    ...e.personaIds.map((id) => ({
      nombre: e.personas.find((p) => p.cuentaId === id)?.nombre ?? '',
      nueva: false,
    })),
    ...e.porAgregar.map((nombre) => ({ nombre, nueva: true })),
  ];
}

export const flujoCuentaDividida: FlujoConversacional<EstadoDivision> = {
  id: 'cuenta_dividida',
  inicial: (ctx, origen) => {
    const c = comoContexto(ctx);
    const { desde, porVoz } = desenvolver(origen);
    const r = resultadoDe(desde, 'confirmar_division');
    if (!r) throw new ErrorDominio('flujo_sin_origen', 'la cuenta dividida empieza con lo que dijiste');
    const p = r.propuesta;
    const cuentas: Opcion[] = cuentasPropias(c).map((x) => ({ id: x.id, nombre: x.nombre }));
    if (p.origenId === CUENTAS_SISTEMA.porAsignar) cuentas.push({ id: p.origenId, nombre: T.TODAVIA_NO_SE });
    const [unica] = p.faltaOrigen?.candidatas ?? [];
    const preelegida =
      p.origenId ??
      (p.faltaOrigen?.motivo === 'aproximado' && p.faltaOrigen.candidatas.length === 1 && unica
        ? unica.id
        : null);
    let e: EstadoDivision = {
      porVoz,
      propuesta: p,
      partes: p.partes,
      origenId: preelegida,
      preelegida,
      personaIds: [...p.personaIds],
      porAgregar: [],
      porAclarar: [],
      aclarados: 0,
      personas: personasConAlias(c),
      cuentas,
    };
    for (const nombre of p.sinResolver) e = clasificar(e, nombre);
    // «con Caro y Juan» sin decir entre cuántos: tú y los nombrados. Si se nombró a más de los que caben, se pregunta.
    if (e.partes === null && nombradas(e) > 0) e = { ...e, partes: nombradas(e) + 1 };
    else if (e.partes !== null && e.partes < minimoPartes(e)) e = { ...e, partes: null };
    return e;
  },
  pasos,
  entendi: (ctx, e, acciones) => {
    const c = comoContexto(ctx);
    const partes = e.partes ?? 2;
    const reparto = repartoCuentaDividida(e.propuesta.total, partes);
    const filas: FilaEntendi[] = [
      { clave: 'que', etiqueta: T.ETIQUETA_QUE, valor: mayuscula(queFue(c, e.propuesta)) },
    ];
    const minimo = minimoPartes(e);
    filas.push(
      filaTocable(
        { clave: 'partes', etiqueta: T.ETIQUETA_ENTRE, valor: T.valorEntre(partes) },
        Array.from({ length: 5 }, (_, i) => minimo + i)
          .filter((n) => n <= MAX_PARTES)
          .map((n) => opcion(String(n), T.valorEntre(n))),
        acciones,
        (v) => {
          const n = Number(v);
          return Number.isSafeInteger(n) && n >= minimo && n <= MAX_PARTES ? { ...e, partes: n } : null;
        },
      ),
    );
    if (reparto) {
      filas.push({
        clave: 'tu_parte',
        etiqueta: T.ETIQUETA_TU_PARTE,
        valor: formatearCentavos(reparto.parteUsuario),
      });
      nombresEnOrden(e).forEach((p, i) => {
        const monto = reparto.partesOtros[i];
        if (monto !== undefined) {
          filas.push({ clave: `persona-${i + 1}`, etiqueta: p.nombre, valor: T.valorTeDebe(monto, p.nueva) });
        }
      });
    }
    filas.push(
      filaTocable(
        {
          clave: 'origen',
          etiqueta: T.ETIQUETA_PAGASTE_CON,
          valor: e.cuentas.find((x) => x.id === e.origenId)?.nombre ?? '',
        },
        e.cuentas.map((x) => opcion(x.id, x.nombre)),
        acciones,
        (v) => (e.cuentas.some((x) => x.id === v) ? { ...e, origenId: v } : null),
      ),
    );
    return {
      titulo: T.TITULO_REGISTRAR,
      monto: e.propuesta.total,
      filas,
      confirmar: { etiqueta: T.CONFIRMAR_REGISTRAR, accion: acciones.guardar },
      cambiar: { etiqueta: T.CAMBIAR_ALGO, accion: acciones.cambiar },
    };
  },
  guardar: async (ctx, e) => {
    const c = comoContexto(ctx);
    const { partes, origenId } = e;
    if (partes === null || origenId === null || e.porAclarar.length > 0 || nombradas(e) !== partes - 1) {
      throw new ErrorDominio('movimiento_invalido', 'faltan datos de la cuenta dividida');
    }
    const p = e.propuesta;
    const alias = aliasPorAprender(e);
    const { resultado, cambioDia } = conCambioDia(c, () =>
      enTransaccion(c, () => {
        const nuevas = e.porAgregar.map((nombre) => crearPersona(c, { nombre }));
        return confirmarCuentaDividida(
          c,
          {
            total: p.total,
            partes,
            personaIds: [...e.personaIds, ...nuevas],
            origenId,
            categoria: p.categoria,
            fecha: p.fecha,
            ...(p.descripcion ? { descripcion: p.descripcion } : {}),
          },
          e.porVoz ? 'voz' : 'texto',
          alias ? { aprender: { alias } } : {},
        );
      }),
    );
    return {
      texto: T.mensajeDivision(mayuscula(queFue(c, p)), p.total, partes),
      detalle: T.detalleTeDeben(resultado.registro.reparto.porCobrarTotal),
      ...(cambioDia ? { cambioDia } : {}),
      deshacer: resultado.deshacer,
    };
  },
  formularioLargo: (e) => {
    dejarPrellenado('cuenta_dividida', {
      ...e.propuesta,
      partes: e.partes,
      origenId: e.origenId,
      faltaOrigen: e.origenId ? null : e.propuesta.faltaOrigen,
      personaIds: [...e.personaIds],
      sinResolver: [...e.porAgregar, ...e.porAclarar.map((x) => x.nombre)],
    });
    return { pathname: '/registrar', params: { flujo: 'cuenta_dividida' } };
  },
};
