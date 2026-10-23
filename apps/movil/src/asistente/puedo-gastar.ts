import { dineroLibre, type Centavos } from '@cartera/core';
import { interpretarMonto } from '@cartera/nlu';
import {
  loCompre,
  obtenerHoy,
  type ConsultaMeAlcanza,
  type Contexto,
  type VistaHoy,
  type VistaMeAlcanza,
} from '../servicios';
import { tituloConsulta } from '../servicios/me-alcanza';
import { formatearCentavos, leerPesos } from '../ui/formato';
import {
  BTN_REGISTRALO,
  BTN_VER_OPCIONES,
  btnLoCompreA,
  lineaEscenario,
  PREGUNTA_CUANTO_CUESTA,
  TEXTO_CALCULANDO_OPCIONES,
  TEXTO_PUEDO_SIN_INGRESO,
  textoComparaHoy,
  textoPuedoGastar,
} from '../pantallas/asistente/textos';
import { BTN_CONFIGURAR_INGRESO_HOY } from '../pantallas/principal/textos';
import type { TurnoConversacion } from './conversacion';
import type { AccionesRegistro } from './registro';
import type { AccionTurno, Respuesta } from './tipos';

/**
 * «¿Puedo gastar en esto?» dentro de la conversación (la función estrella del asistente): «¿puedo gastar 500 en
 * unos tenis?», «¿me alcanza para el cine?». Lo que pasa con tu día sale de `core` (E4 con la compra restada) y, con
 * Plus, la probabilidad de cada opción (contado, meses, esperar) de `meAlcanza` (E8). Describe qué pasa con tu
 * dinero; nunca dice qué deberías hacer (`08 §1`). Lo dicho nunca va a logs (regla 9).
 */

export interface LecturaPuedoGastar {
  /** `null`: no dijo cuánto (se pregunta «¿Cuánto cuesta?»). */
  readonly precio: Centavos | null;
  readonly descripcion: string | null;
}

/** «¿puedo gastar…», «¿puedo comprar(me)…», «¿podría…», «¿me alcanza(ría) para…», «¿me da para…». */
const INTENCION =
  /^(?:y\s+)?(?:si\s+)?(?:(?:puedo|podr[ií]a)\s+(?:gastar(?:me)?|comprar(?:me)?|pagar)|me\s+alcanza(?:r[ií]a)?(?:\s+para)?|alcanza\s+para|me\s+da\s+para)\b/i;

function limpiar(texto: string): string {
  return texto
    .replace(/[¿?¡!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Una cifra dicha o escrita: «500», «$1,500», «5 mil», «quinientos»; `null` si no es cifra. */
export function montoDicho(texto: string): Centavos | null {
  const t = texto
    .trim()
    .replace(/\s*pesos$/i, '')
    .trim();
  if (t === '') return null;
  const escrito = leerPesos(t);
  if (escrito !== null) return escrito > 0 ? escrito : null;
  const dicho = interpretarMonto(t, { admiteCero: false });
  return dicho && dicho.centavos > 0 ? dicho.centavos : null;
}

/**
 * Lee la pregunta en el teléfono (sin nube, cero tokens): la intención, la cifra y en qué. `null` si no es una
 * pregunta de «¿puedo gastar?».
 */
export function leerPuedoGastar(texto: string): LecturaPuedoGastar | null {
  const t = limpiar(texto);
  const m = INTENCION.exec(t);
  if (!m) return null;
  const resto = t
    .slice(m[0].length)
    .trim()
    .replace(/^(?:en|para|por)\s+/i, '');
  let precio: Centavos | null = null;
  const descripcion: string[] = [];
  for (const parte of resto.split(/\s+(?:en|para|de|por)\s+/i)) {
    const p = parte.trim();
    if (p === '') continue;
    const monto: Centavos | null = precio === null ? montoDicho(p) : null;
    if (monto !== null) precio = monto;
    else descripcion.push(p);
  }
  const que = descripcion.join(' de ').trim();
  return { precio, descripcion: que === '' ? null : que };
}

/** Tu día si la compra sale hoy de tu dinero libre (E4 de `core` con la compra restada). */
export function simularCompraHoy(
  vista: VistaHoy,
  precio: Centavos,
): { readonly hoyPuedes: Centavos; readonly libre: Centavos; readonly faltante: Centavos } {
  const r = dineroLibre({
    hoy: vista.hoy,
    fin_horizonte: vista.finEfectivo,
    liquidez: vista.libre - precio,
    colchon: 0,
    compromisos: [],
    tarjetas: [],
    cuotas_msi_no_facturadas: [],
  });
  return { hoyPuedes: r.hoy_puedes_centavos, libre: r.libre, faltante: r.faltante };
}

type AccionesPuedo = Pick<
  AccionesRegistro,
  'nuevoId' | 'abrirR2' | 'abrirMeAlcanza' | 'abrirIngreso' | 'mostrar' | 'reemplazar' | 'agregar'
> & {
  /** Plus: calcula `meAlcanza` y reemplaza el turno `id` con las opciones. */
  readonly calcularPuedoGastar?: (consulta: ConsultaMeAlcanza, id: string) => void;
};

/**
 * El turno de respuesta: qué pasa con tu día si lo compras hoy (todos los planes) y, con Plus, cómo llegas con cada
 * opción. «Regístralo» abre el registro con lo dicho; «Lo compré a N meses» lo registra con su plan.
 */
export function turnoPuedoGastar(
  ctx: Contexto,
  consulta: ConsultaMeAlcanza,
  o: AccionesPuedo,
  id: string,
  opciones?: VistaMeAlcanza | 'calculando',
): TurnoConversacion {
  const vista = obtenerHoy(ctx);
  const titulo = tituloConsulta(consulta);
  if (vista.estado === 'sin_ingreso') {
    const abrir = o.abrirIngreso;
    return {
      id,
      de: 'asistente',
      clase: 'aviso',
      texto: TEXTO_PUEDO_SIN_INGRESO,
      acciones: abrir
        ? [{ etiqueta: BTN_CONFIGURAR_INGRESO_HOY, accion: abrir, testID: `${id}-ingreso` }]
        : [],
      origen: 'probabilidad',
    };
  }
  const antes = formatearCentavos(vista.estado === 'libre_negativo' ? 0 : vista.hoyPuedesCentavos, 'pesos');
  const despues = simularCompraHoy(vista, consulta.precio);
  const texto = textoPuedoGastar({
    titulo: consulta.descripcion ? titulo : null,
    monto: formatearCentavos(consulta.precio),
    antes,
    despues: formatearCentavos(despues.hoyPuedes, 'pesos'),
    faltante: despues.faltante > 0 ? formatearCentavos(despues.faltante) : null,
    proximo: vista.proximoIngreso
      ? { concepto: vista.proximoIngreso.concepto, etiqueta: vista.proximoIngreso.etiqueta }
      : null,
  });
  const lineas: string[] = [];
  const acciones: AccionTurno[] = [
    {
      etiqueta: BTN_REGISTRALO,
      accion: () =>
        o.abrirR2({
          tipo: 'gasto',
          monto: consulta.precio,
          ...(consulta.descripcion ? { descripcion: consulta.descripcion } : {}),
        }),
      testID: `${id}-registrar`,
    },
  ];
  if (opciones === 'calculando') lineas.push(TEXTO_CALCULANDO_OPCIONES);
  else if (opciones?.estado === 'datos_insuficientes') lineas.push(opciones.mensaje);
  else if (opciones?.estado === 'ok') {
    for (const e of opciones.escenarios) {
      if (e.tipo === 'base') continue;
      lineas.push(lineaEscenario(e.etiqueta, e.porcentaje));
    }
    const meses = opciones.escenarios.find((e) => e.tipo === 'msi');
    if (meses) {
      acciones.push({
        etiqueta: btnLoCompreA(meses.etiqueta),
        accion: () => {
          const r = loCompre(ctx, {
            escenario: meses.escenario as Parameters<typeof loCompre>[1]['escenario'],
            ...(consulta.descripcion ? { descripcion: consulta.descripcion } : {}),
          });
          if (r.tipo === 'msi')
            o.mostrar({ resultado: 'registrado_msi', compra: r.compra, deshacer: r.deshacer }, id);
        },
        testID: `${id}-meses`,
      });
    }
  } else {
    lineas.push(textoComparaHoy(consulta.precio <= vista.hoyPuedesCentavos, antes));
  }
  const abrirDetalle = o.abrirMeAlcanza;
  if (opciones !== undefined && opciones !== 'calculando' && abrirDetalle) {
    acciones.push({
      etiqueta: BTN_VER_OPCIONES,
      accion: () => abrirDetalle(consulta),
      testID: `${id}-detalle`,
    });
  }
  return {
    id,
    de: 'asistente',
    clase: 'aviso',
    texto,
    ...(lineas.length > 0 ? { detalle: lineas.join('\n') } : {}),
    acciones,
    origen: 'probabilidad',
  };
}

/**
 * Turnos de «¿puedo gastar?»: con la cifra, la respuesta (y, con Plus, las opciones en cuanto se calculan); sin
 * cifra, una sola pregunta «¿Cuánto cuesta?» que se contesta hablando, escribiendo o con el campo.
 */
export function turnosPuedoGastar(
  ctx: Contexto,
  lectura: LecturaPuedoGastar | ConsultaMeAlcanza,
  o: AccionesPuedo,
): TurnoConversacion[] {
  const precio = lectura.precio;
  const descripcion = lectura.descripcion ?? undefined;
  if (precio === null) {
    const id = o.nuevoId('cuanto-cuesta');
    return [
      {
        id,
        de: 'asistente',
        clase: 'pregunta',
        texto: PREGUNTA_CUANTO_CUESTA,
        chips: [],
        campo: 'monto',
        responder: (r: Respuesta) => {
          const monto = r.tipo === 'monto' ? r.centavos : r.tipo === 'texto' ? montoDicho(r.texto) : null;
          if (monto === null || monto <= 0) return;
          o.reemplazar({ id, de: 'asistente', clase: 'texto', texto: PREGUNTA_CUANTO_CUESTA });
          o.agregar(
            {
              id: o.nuevoId('persona'),
              de: 'persona',
              texto: formatearCentavos(monto),
              porVoz: r.tipo === 'texto' && r.porVoz,
            },
            ...turnosPuedoGastar(ctx, { precio: monto, descripcion: descripcion ?? null }, o),
          );
        },
      },
    ];
  }
  const consulta: ConsultaMeAlcanza = {
    ...('meses' in lectura || 'fecha' in lectura ? (lectura as ConsultaMeAlcanza) : {}),
    precio,
    ...(descripcion ? { descripcion } : {}),
  };
  const id = o.nuevoId('puedo-gastar');
  const calcular = o.calcularPuedoGastar;
  if (calcular) calcular(consulta, id);
  return [turnoPuedoGastar(ctx, consulta, o, id, calcular ? 'calculando' : undefined)];
}
