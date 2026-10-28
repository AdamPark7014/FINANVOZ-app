import type { ChipIntencion, ClaveIntencion } from '../../asistente/chips';
import type { DatosPuedoGastar } from '../../asistente/tipos';
import type { VistaHoy } from '../../servicios';
import { cifraEnPalabras, etiquetaHablada, formatearCentavos } from '../../ui/formato';
import type { FilaCalculo } from './TarjetaCalculo';

/**
 * Redacción del asistente (Ola 7, `docs/diseno/OLA-7-ASISTENTE.md` §1.4): es-MX, tuteo, sin exclamaciones ni
 * consejos (`08 §1`), cada turno en dos líneas como máximo. Solo presenta lo que ya calculó `servicios/`.
 */

export const BTN_ME_ALCANZA = '¿Me alcanza?';

// ——— Conversación ———

export const TITULO_ENTENDI_REGISTRO = 'Entendí · ¿lo registro?';
export const TITULO_ENTENDI_GUARDO = 'Entendí · ¿lo guardo?';
export const BTN_SI_REGISTRALO = 'Sí, regístralo';
export const BTN_SI_GUARDALO = 'Sí, guárdalo';
export const BTN_CAMBIAR = 'Cambiar';
export const BTN_DESHACER = 'Deshacer';
export const PISTA_DESHACER = 'Borra lo que acabo de registrar';
export const TEXTO_DESHICE = 'Deshice el registro.';
export const BTN_VER_MOVIMIENTOS = 'Ver movimientos';
export const PISTA_VER_MOVIMIENTOS = 'Abre Movimientos con los movimientos de esta respuesta';
export const TEXTO_INTERPRETANDO = 'Un segundo…';
export const TEXTO_EXPLICANDO = 'Revisando tus datos…';

/** Filas de la tarjeta «Entendí» (R1). */
export const FILA_QUE = 'Qué';
export const FILA_CUENTA = 'Cuenta';
export const FILA_CATEGORIA = 'Categoría';
export const FILA_CUANDO = 'Cuándo';
export const VALOR_SIN_ELEGIR = 'Elige una';
/** Bajo «Sí, regístralo» mientras falta la cuenta: el botón está inactivo y la fila «Cuenta» abre los chips. */
export const MOTIVO_ELIGE_CUENTA = 'Elige la cuenta para poder registrarlo.';

/** «Hoy, dom 11 oct» · «Ayer, sáb 10 oct» · «Vie 9 oct». */
export function valorCuando(etiqueta: string, relativo: 'hoy' | 'ayer' | null): string {
  if (relativo === 'hoy') return `Hoy, ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`;
  if (relativo === 'ayer') return `Ayer, ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`;
  return etiqueta;
}

/** Pista bajo «Sí, regístralo» cuando la frase vino por voz. */
export function pistaDecirSi(otraCuenta: string | null): string {
  return otraCuenta
    ? `También puedes decir «sí» o «no, fue con ${otraCuenta}».`
    : 'También puedes decir «sí» o «no».';
}

/** «Entendí · ¿cambio tu ingreso?» a partir del título de la tarjeta de ajuste («¿Cambio tu ingreso?»). */
export function tituloEntendiDe(pregunta: string): string {
  const cuerpo = pregunta.startsWith('¿')
    ? `¿${pregunta.charAt(1).toLowerCase()}${pregunta.slice(2)}`
    : pregunta;
  return `Entendí · ${cuerpo}`;
}

/** Turno de la persona para el lector: «Dijiste: tacos 80 en efectivo». */
export function etiquetaTurnoPersona(texto: string, porVoz: boolean): string {
  return `${porVoz ? 'Dijiste' : 'Escribiste'}: ${etiquetaHablada(texto)}`;
}

// ——— No entendí y reparación ———

export const BTN_CORREGIR_OIDO = 'Corregir lo que oí';
export const PISTA_CORREGIR_OIDO = 'Abre lo que oí en el teclado para corregirlo';

export function textoNoEntendi(oido: string): string {
  return `Oí «${oido}». ¿Cuál de estas es?`;
}

export const TEXTO_NO_ENTENDI_VACIO = 'No te entendí. Dímelo otra vez o escríbelo.';
export const TEXTO_FRASE_LARGA = 'Eso fue muy largo. Dímelo en una frase más corta.';

/** Chips cuando la frase quedó por interpretar (sin red, sin cupo o error). */
export const CHIP_ES_GASTO = 'Es un gasto';
export const CHIP_ES_INGRESO = 'Es un ingreso';
export const CHIP_ESCRIBIRLO = 'Escribirlo';

// ——— Barra de voz ———

export const ETIQUETA_TECLADO = 'Escribir';
export const PISTA_TECLADO = 'Abre un campo para escribir lo que quieres registrar';
export const ETIQUETA_CERRAR_TECLADO = 'Cerrar el teclado';
export const ETIQUETA_CAMPO_REGISTRAR = '¿Qué registro?';
export const BTN_ENVIAR_REGISTRO = 'Registrar';
export const BTN_FORMULARIO = 'Registrar con formulario';
export const PISTA_FORMULARIO = 'Abre el formulario corto para llenar los datos';

// ——— Dock de voz (dirección B, `02 §2`) ———

/** «¿Me alcanza?» del dock: escucha con este arranque (`unirPrefijo`) o lo deja escrito en el campo. */
export const PREFIJO_ME_ALCANZA = 'me alcanza para ';
export const PREFIJO_ME_ALCANZA_ESCRITO = '¿Me alcanza para ';
export const PISTA_DOCK_ME_ALCANZA = 'Te escucho: dime qué quieres comprar y cuánto cuesta';
export const BTN_DOCK_BUSCAR = 'Buscar';
export const PISTA_DOCK_BUSCAR = 'Abre un campo para buscar en tus movimientos';
export const ETIQUETA_CERRAR_BUSQUEDA = 'Cerrar la búsqueda';
export const BTN_DOCK_AGREGAR = 'Agregar';
export const PISTA_DOCK_AGREGAR = 'Agrega una cuenta, una tarjeta de crédito o un pago fijo';
export const ETIQUETA_CERRAR_AGREGAR = 'Cerrar las opciones para agregar';
/** Escribir y el micrófono fuera del asistente: llevan a él, que es quien contesta. */
export const PISTA_DOCK_ESCRIBIR_FUERA = 'Abre el asistente con el campo para escribir';
export const ETIQUETA_DOCK_HABLAR_MOVIMIENTOS = 'Toca para preguntar o registrar';
export const ETIQUETA_DOCK_HABLAR_CUENTAS = 'Toca para hablar, por ejemplo «traigo 300 en efectivo»';
export const PISTA_DOCK_HABLAR_FUERA = 'Abre el asistente escuchando';

// ——— R2 (formulario corto, modal) ———

export const TITULO_R2 = 'Registrar';
export const BTN_CERRAR_R2 = 'Cerrar';
export const ACCESIBILIDAD_CERRAR_R2 = 'Cerrar registro';
export const PISTA_CERRAR_R2 = 'Vuelve al asistente; lo que no guardaste no se registra';

export function textoEstoOiR2(oido: string): string {
  return `Esto oí: «${oido}». Revisa y registra.`;
}

// ——— Confirmación por voz ———

export const TEXTO_ESPERO_SI = 'Te escucho: di «sí» o «no».';

// ——— «¿Puedo gastar en esto?» (función estrella, describe qué pasa con tu dinero; nunca qué deberías hacer) ———

export const PREGUNTA_CUANTO_CUESTA = '¿Cuánto cuesta?';
export const TEXTO_PUEDO_SIN_INGRESO = 'Para decirte cómo queda tu día, dime cada cuándo te pagan.';
export const TEXTO_CALCULANDO_OPCIONES = 'Calculando cómo llegas con cada opción…';
export const BTN_VER_OPCIONES = 'Ver opciones';

function enMinuscula(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** «Lo compré a 3 MSI con la Oro». */
export function btnLoCompreA(etiqueta: string): string {
  return `Lo compré ${enMinuscula(etiqueta)}`;
}

/** «A 3 MSI con la Oro: 92 % de llegar sin tocar tu colchón.» */
export function lineaEscenario(etiqueta: string, porcentaje: string): string {
  return `${etiqueta}: ${porcentaje} de llegar sin tocar tu colchón.`;
}

/**
 * «Te alcanza. Si compras unos tenis de $500 hoy, tu día pasa de $268 a $143 hasta el vie 30.» (B3; sin qué: «Si
 * gastas $500 hoy, …») o, si no alcanza, «No te alcanza. …, te faltarían $340 para cubrir lo que viene antes del jue
 * 15.» Describe qué pasa con tu dinero, no qué hacer (`08 §1`). Las cifras ya vienen de `core`.
 */
export function textoPuedoGastar(d: {
  /** «Unos tenis de $500»; `null` sin descripción. */
  titulo: string | null;
  monto: string;
  antes: string;
  despues: string;
  faltante: string | null;
  proximo: { concepto: string; etiqueta: string } | null;
}): string {
  const si = d.titulo ? `Si compras ${enMinuscula(d.titulo)} hoy` : `Si gastas ${d.monto} hoy`;
  if (d.faltante) {
    const cuando = d.proximo ? `antes del ${d.proximo.etiqueta}` : 'en los próximos días';
    return `No te alcanza. ${si}, te faltarían ${d.faltante} para cubrir lo que viene ${cuando}.`;
  }
  const hasta = d.proximo ? ` hasta el ${d.proximo.etiqueta}` : '';
  return d.antes === d.despues
    ? `Te alcanza. ${si}, tu día sigue en ${d.despues}${hasta}.`
    : `Te alcanza. ${si}, tu día pasa de ${d.antes} a ${d.despues}${hasta}.`;
}

// ——— Escuchando ———

export const TEXTO_TERMINO_SOLO = 'Cuando dejes de hablar, termino solo.';
export const BTN_CANCELAR_ESCUCHA = 'Cancelar';
export const PISTA_CANCELAR_ESCUCHA = 'Deja de escuchar sin registrar nada';

// ——— Preguntas que se contestan con una cifra, fecha o texto (sin campos en la conversación) ———

export const TEXTO_DIMELO_RESPUESTA = 'Dímelo con el micrófono o escríbelo abajo.';
export const CHIP_ESCRIBIR_RESPUESTA = 'Escribirlo';
export const PISTA_ESCRIBIR_RESPUESTA = 'Abre el campo de abajo para escribir tu respuesta';

// ——— Dirección B «Plática»: reposo, píldora, registro y «¿Me alcanza?» (`docs/diseno/direccion-b/`) ———

/** «Buenos días» de 5 a 11:59, «Buenas tardes» de 12 a 18:59 y «Buenas noches» el resto. */
export function saludoPorHora(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function textoDias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`;
}

/** «hasta tu quincena del vie 30, en 4 días.» (B1); `null` si el día no se reparte hasta un ingreso conocido. */
export function textoHastaIngreso(
  v: Pick<VistaHoy, 'estadoHorizonte' | 'proximoIngreso' | 'dias'>,
): string | null {
  if (v.estadoHorizonte !== 'normal' || !v.proximoIngreso) return null;
  return `hasta tu ${v.proximoIngreso.concepto} del ${v.proximoIngreso.etiqueta}, en ${textoDias(v.dias)}.`;
}

/** Libre negativo: «Te faltan $374 para cubrir lo que viene antes del jue 15.» */
export function textoFaltanteHoy(faltante: string, etiqueta: string | null): string {
  return `Te faltan ${faltante} para cubrir lo que viene ${etiqueta ? `antes del ${etiqueta}` : 'en los próximos días'}.`;
}

export const BTN_COMO_LO_CALCULE = 'Cómo lo calculé';
export const TITULO_PUEDES_DECIRME = 'Puedes decirme';
export const ETIQUETA_PUEDES_DECIRME = 'Frases que puedes decirme';

/** Lo que se ve en «Puedes decirme» por intención (B1); tocarla escucha con su arranque. */
export const EJEMPLO_INTENCION: Record<ClaveIntencion, string> = {
  gaste: 'coca 25 en efectivo',
  puedo_gastar: '¿me alcanza para unos tenis de 500?',
  me_pagaron: 'ya me pagaron la quincena',
  contar_efectivo: 'traigo 300 en efectivo',
  pagar_tarjeta: 'ya pagué la tarjeta',
};

export function pistaEjemploIntencion(chip: Pick<ChipIntencion, 'pista'>): string {
  return chip.pista;
}

/** La píldora de B2: «Hoy puedes gastar · hasta el vie 30». */
export function textoPildoraDia(
  v: Pick<VistaHoy, 'estado' | 'estadoHorizonte' | 'proximoIngreso' | 'faltante'>,
): string {
  if (v.estado === 'libre_negativo') return `Hoy te faltan ${formatearCentavos(v.faltante)}`;
  return v.estadoHorizonte === 'normal' && v.proximoIngreso
    ? `Hoy puedes gastar · hasta el ${v.proximoIngreso.etiqueta}`
    : 'Hoy puedes gastar';
}

/** Lo que oye el lector en la píldora: la frase y la cifra en palabras («… doscientos sesenta y ocho pesos»). */
export function etiquetaPildoraDia(texto: string, cifraEnPalabras: string): string {
  return `${etiquetaHablada(texto.replace(' · ', ', '))}: ${cifraEnPalabras}`;
}

/** Encabezado de la tarjeta de registro (B2): genérico para cualquier movimiento. */
export function tituloRegistro(corregido: boolean): string {
  return corregido ? 'Listo, lo corregí.' : 'Listo, lo registré.';
}

/** Nombre de cada chip de la tarjeta de registro para el lector. */
export const NOMBRE_CAMBIO_REGISTRO = { categoria: 'Categoría', cuenta: 'Cuenta', dia: 'Cuándo' } as const;

/** «Categoría: Antojos. Cambiar» (como en C2). */
export function etiquetaChipRegistro(nombre: string, actual: string): string {
  return `${nombre}: ${actual}. Cambiar`;
}

/** «Si oí mal, solo dime «eran 30» o «fue con la Nu».» (B2), con otra de tus cuentas si la hay. */
export function pistaCorregirRegistro(otraCuenta: string | null): string {
  return otraCuenta
    ? `Si oí mal, solo dime «eran 30» o «fue con ${otraCuenta}».`
    : 'Si oí mal, solo dime «eran 30» o «fue ayer».';
}

/** «Tu día pasa de $275 a $268.» en tres partes para resaltar la cifra nueva; `null` si no tiene esa forma. */
export function separarCambioDia(texto: string): { antes: string; despues: string; final: string } | null {
  const m = /^(.* a )(\$[\d,]+(?:\.\d{2})?)(\.)$/.exec(texto);
  return m && m[1] && m[2] && m[3] ? { antes: m[1], despues: m[2], final: m[3] } : null;
}

/** «Lo compré» de «¿Me alcanza?» (B3): abre el registro con la compra para guardarla. */
export const BTN_LO_COMPRE = 'Lo compré';
export const PISTA_LO_COMPRE = 'Abre el registro con la compra para guardarla';
export const TITULO_CONTADO_HOY = 'Hoy, de contado';
export const TEXTO_HOY_NO_CAMBIA = 'Hoy no cambia nada';
export const TEXTO_AL_DIA = 'al día';
export const TEXTO_NO_ES_ASESORIA_CORTO = 'Te digo qué pasa con tu dinero; no es asesoría financiera.';

/** «El vie 30, con tu quincena». */
export function tituloEsperarIngreso(etiqueta: string, concepto: string): string {
  return `El ${etiqueta}, con tu ${concepto}`;
}

/** «Te quedan $575 libres». */
export function textoTeQuedanLibres(libre: string): string {
  return `Te quedan ${libre} libres`;
}

export function btnRecuerdamelo(etiqueta: string): string {
  return `Recuérdamelo el ${etiqueta}`;
}

export function textoRecordatorioListo(etiqueta: string): string {
  return `Te lo recuerdo el ${etiqueta}.`;
}

/** «Nu, internet y tanda». */
export function unirConY(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

function menos(centavos: number): string {
  return `−${formatearCentavos(Math.abs(centavos))}`;
}

interface DatosCalculo {
  readonly tienes: { readonly monto: number; readonly nombres: readonly string[] };
  readonly reservado: { readonly monto: number; readonly nombres: readonly string[] };
  readonly colchon: number;
  readonly compra?: { readonly que: string | null; readonly precio: number };
  readonly libre: number;
  readonly dias: number;
  readonly alDia: number;
}

/** Las filas de «Cómo lo calculé» (B3), todas con cifras ya calculadas por `core`. */
export function filasCalculo(d: DatosCalculo, prefijo = 'desglose'): FilaCalculo[] {
  const filas: FilaCalculo[] = [
    {
      etiqueta: d.tienes.nombres.length > 0 ? `Tienes en ${unirConY(d.tienes.nombres)}` : 'Tienes',
      valor: formatearCentavos(d.tienes.monto),
      centavos: d.tienes.monto,
      testID: `${prefijo}-liquidez`,
    },
    {
      etiqueta: d.reservado.nombres.length > 0 ? `Reservado: ${unirConY(d.reservado.nombres)}` : 'Reservado',
      valor: menos(d.reservado.monto),
      centavos: -d.reservado.monto,
      testID: `${prefijo}-reservado`,
    },
    { etiqueta: 'Colchón', valor: menos(d.colchon), centavos: -d.colchon, testID: `${prefijo}-colchon` },
  ];
  if (d.compra) {
    const que = d.compra.que
      ? `${d.compra.que.charAt(0).toUpperCase()}${d.compra.que.slice(1)}`
      : 'La compra';
    filas.push({
      etiqueta: que,
      valor: menos(d.compra.precio),
      centavos: -d.compra.precio,
      testID: `${prefijo}-compra`,
    });
  }
  filas.push({
    etiqueta: `Libre ${formatearCentavos(Math.max(0, d.libre))} entre ${textoDias(d.dias)}`,
    valor: `${formatearCentavos(d.alDia, 'pesos')} ${TEXTO_AL_DIA}`,
    centavos: d.alDia,
    fuerte: true,
    testID: `${prefijo}-libre`,
  });
  return filas;
}

/** «Cómo lo calculé» del día (B1): de `VistaHoy`, sin cálculos nuevos. */
export function filasCalculoDia(vista: VistaHoy, nombresTienes: readonly string[]): FilaCalculo[] {
  return filasCalculo({
    tienes: { monto: vista.liquidez, nombres: nombresTienes },
    reservado: { monto: vista.reservado, nombres: vista.reservadoDetalle.map((r) => r.concepto) },
    colchon: vista.colchon,
    libre: vista.libre,
    dias: vista.dias,
    alDia: vista.estado === 'libre_negativo' ? 0 : vista.hoyPuedesCentavos,
  });
}

/** «Cómo lo calculé» de una compra (B3): lo del día con la compra restada (E4 de `core`). */
export function filasCalculoCompra(d: DatosPuedoGastar): FilaCalculo[] {
  return filasCalculo(
    {
      tienes: d.tienes,
      reservado: d.reservado,
      colchon: d.colchon,
      compra: { que: d.que, precio: d.precio },
      libre: d.libreDespues,
      dias: d.dias,
      alDia: d.despues,
    },
    'calculo',
  );
}

// ——— Dirección B+ «Viva»: el inicio «Tablero vivo» (`docs/diseno/direccion-b-plus/D1-reposo.png`) ———

export const TEXTO_AL_DIA_HEROE = 'al día';

/** Nombre de cada parte de la barra de tu dinero (D1); el faltante solo sale cuando lo que tienes no alcanza. */
export const ETIQUETA_PARTE_DINERO = {
  apartado: 'Apartado',
  colchon: 'Colchón',
  libre: 'Libre',
  faltante: 'Faltan',
} as const;

/** «De tus $5,249». */
export function textoDeTus(total: string): string {
  return `De tus ${total}`;
}

/** «Hasta tu quincena». */
export function tituloPista(concepto: string): string {
  return `Hasta tu ${concepto}`;
}

/** La insignia de la pista: «4 días», «1 día» u «Hoy». */
export function textoDiasPista(n: number): string {
  return n <= 0 ? 'Hoy' : textoDias(n);
}

export const TEXTO_HOY_PISTA = 'Hoy';
export const TEXTO_NADA_FIJO = 'nada fijo';

const DIA_LARGO: Record<string, string> = {
  lun: 'lunes',
  mar: 'martes',
  mié: 'miércoles',
  jue: 'jueves',
  vie: 'viernes',
  sáb: 'sábado',
  dom: 'domingo',
};

/** «Nu ••4410» → «Nu»: en la pista no caben los últimos cuatro. */
export function nombreCorto(nombre: string): string {
  return nombre.replace(/\s*••\d{4}$/, '').trim() || nombre;
}

function mayusculaInicial(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Lo que se ve de un evento de la pista: el concepto y su cifra («Internet» · «−$499», «Pagar Nu»). */
export function lineasEventoPista(e: {
  tipo: 'egreso' | 'tarjeta' | 'ingreso';
  concepto: string;
  monto: number;
}): { concepto: string; cifra: string | null } {
  if (e.tipo === 'tarjeta') return { concepto: `Pagar ${nombreCorto(e.concepto)}`, cifra: null };
  const monto = formatearCentavos(e.monto);
  return {
    concepto: mayusculaInicial(e.concepto),
    cifra: e.tipo === 'ingreso' ? `+${monto}` : `−${monto}`,
  };
}

/** Lo que oye el lector en cada día de la pista: «Hoy, lunes 26: nada fijo.» · «Jueves 29: tanda, menos …». */
export function etiquetaDiaPista(d: {
  hoy: boolean;
  diaSemana: string;
  dia: number;
  eventos: readonly { tipo: 'egreso' | 'tarjeta' | 'ingreso'; concepto: string; monto: number }[];
}): string {
  const dia = `${DIA_LARGO[d.diaSemana] ?? d.diaSemana} ${d.dia}`;
  const cuando = d.hoy ? `Hoy, ${dia}` : mayusculaInicial(dia);
  const que =
    d.eventos.length === 0
      ? TEXTO_NADA_FIJO
      : d.eventos
          .map((e) =>
            e.tipo === 'tarjeta'
              ? `pagar ${nombreCorto(e.concepto)}, ${etiquetaHablada(formatearCentavos(e.monto))}`
              : `${e.concepto}, ${etiquetaHablada(`${e.tipo === 'ingreso' ? '' : '−'}${formatearCentavos(e.monto)}`)}`,
          )
          .join('; ');
  return `${cuando}: ${que}.`;
}

/** La fila de lo pendiente de una tarjeta (D1): «Tu Nu vence el jue 29» · «Paga $1,420 y no generas intereses». */
export function tituloPagoPendiente(texto: string): string {
  return texto.replace(/\.$/, '');
}

/** Ya vencida, pagar ya no evita los intereses: se dice la cifra sin prometerlo. */
export function detallePagoPendiente(pngi: string, cuando: 'por_vencer' | 'vencido' = 'por_vencer'): string {
  return cuando === 'vencido'
    ? `Pago para no generar intereses: ${pngi}`
    : `Paga ${pngi} y no generas intereses`;
}

// ——— Dirección B+ «Viva»: «Te escucho» (`docs/diseno/direccion-b-plus/D2-escuchando.png`) ———

export const ETIQUETA_TE_ESCUCHO = 'Te escucho';
export const TEXTO_VOY_ENTENDIENDO = 'Voy entendiendo';
export const PISTA_ESCUCHA_MANTENIENDO = 'Suelta para registrar · desliza para cancelar';
export const PISTA_ESCUCHA_TOCANDO = 'Toca el micrófono para terminar · la X cancela';
export const CHIP_ME_ALCANZA_ENTENDIDO = '¿Me alcanza?';

/** Lo que se ve de la frase en vivo: los últimos 90 caracteres, con «…» si había más. */
export function ultimoTramo(parcial: string, maximo = 90): string {
  const t = parcial.trim();
  if (t.length <= maximo) return t;
  const corte = t.slice(t.length - maximo);
  const espacio = corte.indexOf(' ');
  return `…${espacio > 0 ? corte.slice(espacio) : corte}`;
}

/** Lo que oye el lector de «Voy entendiendo»: «Voy entendiendo: veinticinco pesos, Antojos, Cartera.» */
export function etiquetaLoEntendido(e: {
  monto: number | null;
  categoria: { nombre: string } | null;
  cuenta: { nombre: string; seguro: boolean } | null;
  meAlcanza: boolean;
}): string {
  const partes = [
    ...(e.monto !== null ? [cifraEnPalabras(e.monto)] : []),
    ...(e.meAlcanza ? ['¿me alcanza?'] : []),
    ...(e.categoria ? [e.categoria.nombre] : []),
    ...(e.cuenta ? [e.cuenta.seguro ? e.cuenta.nombre : `quizá ${e.cuenta.nombre}`] : []),
  ];
  return `${TEXTO_VOY_ENTENDIENDO}: ${partes.join(', ')}.`;
}

// ——— Dirección B+ «Viva»: registro y racha (`docs/diseno/direccion-b-plus/D3-registro.png`) ———

export const TEXTO_TU_DIA = 'Tu día';

/** «6 días seguidos anotando todo». */
export function textoRacha(dias: number): string {
  return `${dias} días seguidos anotando todo`;
}

/** El «−$7» de la píldora tras registrar (D3); `null` si el día no cambió. */
export function textoDeltaDia(delta: number): string | null {
  if (delta === 0) return null;
  return `${delta < 0 ? '−' : '+'}${formatearCentavos(Math.abs(delta), 'pesos')}`;
}

/** Lo que oye el lector del cambio en la píldora: «Bajó siete pesos.» / «Subió…». */
export function etiquetaDeltaDia(delta: number): string {
  return `${delta < 0 ? 'Bajó' : 'Subió'} ${cifraEnPalabras(Math.abs(delta), 'pesos')}.`;
}

// ——— Dirección B+ «Viva»: «¿Me alcanza?» (`docs/diseno/direccion-b-plus/D4-alcanza.png`) ———

/** «Sí te alcanza.» / «No te alcanza.» (el veredicto, junto al orbe). */
export function tituloPuedoGastar(falta: boolean): string {
  return falta ? 'No te alcanza.' : 'Sí te alcanza.';
}

/** «unos tenis» → «los»; «una tele» → «la»; lo demás, «lo». */
function pronombreDe(que: string | null): string {
  const q = (que ?? '').trim().toLowerCase();
  if (/^(unos|los)\b/.test(q)) return 'los';
  if (/^(unas|las)\b/.test(q)) return 'las';
  if (/^(una|la)\b/.test(q)) return 'la';
  return 'lo';
}

/**
 * La línea bajo el veredicto (D4) en tres partes para resaltar la cifra: «Si los compras hoy, tu día baja a » ·
 * «$143» · «.». Describe qué pasa con tu dinero, no qué hacer (`08 §1`); las cifras ya vienen de `core`.
 */
export function sublineaPuedoGastar(d: {
  que: string | null;
  monto: string;
  antes: string;
  despues: string;
  faltante: string | null;
  proximo: { etiqueta: string } | null;
}): { antes: string; cifra: string; final: string } {
  const si = d.que ? `Si ${pronombreDe(d.que)} compras hoy` : `Si gastas ${d.monto} hoy`;
  if (d.faltante) {
    const cuando = d.proximo ? `antes del ${d.proximo.etiqueta}` : 'en los próximos días';
    return {
      antes: `${si}, te faltarían `,
      cifra: d.faltante,
      final: ` para cubrir lo que viene ${cuando}.`,
    };
  }
  return d.antes === d.despues
    ? { antes: `${si}, tu día sigue en `, cifra: d.despues, final: '.' }
    : { antes: `${si}, tu día baja a `, cifra: d.despues, final: '.' };
}

/** «Tienes $5,224» en la cabecera de «Cómo lo calculé» (D4). */
export function textoTienes(monto: string): string {
  return `Tienes ${monto}`;
}

/** «$575 libres ÷ 4 días = » · «$143 al día» (D4). */
export function lineaDivision(
  libre: string,
  dias: number,
  alDia: string,
): { cuenta: string; resultado: string } {
  return { cuenta: `${libre} libres ÷ ${textoDias(dias)} = `, resultado: `${alDia} ${TEXTO_AL_DIA}` };
}
