import {
  etiquetaDiaMes,
  INTERPRETACIONES_NUBE_MES,
  type CodigoLimite,
  type Plan,
  type VistaPlan,
} from '../../servicios';
import type { OfertaPlus } from '../../suscripciones/tipos';
import { etiquetaHablada } from '../../ui/formato';

/** Redacción del plan (`01 §11`, `02 §14`): tuteo, sin tecnicismos; los precios los pone la tienda. */

/** `testID` estables para pruebas y Maestro (`02 §12` Plan). */
export const ID = {
  pantalla: 'pantalla-plan',
  tituloPantalla: 'plan-titulo-pantalla',
  volver: 'plan-volver',
  actual: 'plan-actual',
  titulo: 'plan-titulo',
  detalle: 'plan-detalle',
  administrar: 'plan-administrar',
  incluye: 'plan-incluye',
  sinTienda: 'plan-sin-tienda',
  cargando: 'plan-cargando',
  errorOfertas: 'plan-error-ofertas',
  vacioOfertas: 'plan-vacio-ofertas',
  intentar: 'plan-intentar',
  mensaje: 'plan-mensaje',
  restaurar: 'plan-restaurar',
  notaTienda: 'plan-nota-tienda',
  notaSimulada: 'plan-nota-simulada',
  oferta: (periodo: 'mensual' | 'anual') => `plan-oferta-${periodo}` as const,
  ofertaDetalle: (periodo: 'mensual' | 'anual') => `plan-oferta-detalle-${periodo}` as const,
  ajustesPlan: 'ajustes-plan',
  ajustesPlanTitulo: 'ajustes-plan-titulo',
  ajustesPlanDetalle: 'ajustes-plan-detalle',
  ajustesPlanVer: 'ajustes-plan-ver',
  puertaPlus: 'puerta-plus',
  puertaPlusConocer: 'puerta-plus-conocer',
  puertaPlusPronto: 'puerta-plus-pronto',
  soloIos: 'plan-solo-ios',
  plusDePrueba: 'plan-plus-de-prueba',
  notaPlusDePrueba: 'plan-nota-plus-de-prueba',
} as const;

export const TITULO_PANTALLA = 'Finanvoz Plus';

/**
 * iPhone (M14): esta versión no tiene compras ni tienda, y Apple no admite mencionar otras plataformas ni ofrecer
 * compras que no existen (2.3.10, 3.1.1). Nada de tiendas ni precios en estos dos textos.
 */
export const TITULO_PLAN_IOS = 'Plus todavía no está en iPhone';
export const CUERPO_PLAN_IOS =
  'Por ahora Finanvoz en iPhone incluye todo lo de la versión Gratis, sin cobros. Cuando Plus esté disponible aquí, lo verás en esta pantalla.';
export const SECCION_INCLUYE = 'Plus incluye';
export const SECCION_AJUSTES = 'Plan';
export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER = 'Cierra esta pantalla';
export const ETIQUETA_VER_PLANES = 'Ver planes';
export const ETIQUETA_CONOCER_PLUS = 'Conocer Plus';
export const ETIQUETA_ADMINISTRAR = 'Administrar en Google Play';
export const ETIQUETA_RESTAURAR = 'Restaurar compras';
export const ETIQUETA_INTENTAR = 'Intentar de nuevo';
export const CARGANDO_OFERTAS = 'Cargando planes…';
export const NOTA_COMPRA_SIMULADA =
  'Compra simulada: esta build de desarrollo no tiene tienda y no cobra nada.';

/** Las funciones de Plus; solo lo que ya existe en la app, lo que llega en hitos futuros no se promete aquí. */
export const FUNCIONES_PLUS = [
  'Probabilidad de llegar a tu próximo pago sin tocar tu colchón',
  '«¿Me alcanza?»: compara pagar de contado, a meses o esperar',
  'Tarjeta del día: con cuál te conviene pagar hoy',
  'Tus meses sin intereses de los próximos 12 meses',
  'Pregúntame lo que quieras sobre tu dinero y te explico el porqué: cuánto llevas gastado, cuánto debes y qué pagos vienen',
  'Deducciones personales: con tus facturas, cuánto llevas deducible en el año y cuánto ISR podrías ahorrar',
] as const;

/** Lo que incluye Plus contratado: las funciones y el cupo del intérprete en la nube, que aplica el proxy. */
export const INCLUYE_PLUS = [
  ...FUNCIONES_PLUS,
  `${INTERPRETACIONES_NUBE_MES.plus} frases al mes interpretadas en internet (en Gratis, ${INTERPRETACIONES_NUBE_MES.gratis})`,
] as const;

/**
 * «Plus de prueba» (build de prueba sin tienda): sin cobro, sin fecha, sin ofertas y sin nombrar tiendas. El cupo
 * de frases en internet no se promete: lo aplica el proxy, que no sabe de la prueba.
 */
export const TITULO_PLUS_DE_PRUEBA = 'Plus de prueba';
export const TEXTO_PLUS_DE_PRUEBA =
  'Estás usando Finanvoz Plus de prueba. Mientras dure la prueba no hay cobro.';
export const SECCION_INCLUYE_PRUEBA = 'Tu prueba incluye';
export const NOTA_PLUS_DE_PRUEBA =
  'Cuando termine la prueba, tu cuenta vuelve a Gratis y no pierdes ningún dato.';

/** Candados y puertas sin tienda ni prueba: nada que contratar todavía, así que no hay botón (`02 §12`). */
export const SUFIJO_PLUS_PRONTO = ' · Plus, muy pronto';
export const PUERTA_PLUS_SIN_TIENDA =
  'Plus todavía no está disponible en esta versión. Cuando lo esté, lo verás aquí.';

export const INCLUYE_GRATIS =
  'Gratis siempre: tu «hoy puedes», captura de notificaciones, registro por voz, cuentas y tarjetas sin límite, avisos, arqueo, descargar y borrar tus datos.';

export const NOTA_TIENDA =
  'El cobro lo hace Google Play. Si cancelas antes de que termine la prueba, no se te cobra. Si no sigues con Plus, tu cuenta vuelve a Gratis y no pierdes ningún dato.';

export const MENSAJE_SIN_TIENDA =
  'Plus todavía no se puede contratar en esta versión. Cuando se pueda, lo verás aquí; mientras, todo lo de Gratis funciona igual.';
export const MENSAJE_ERROR_OFERTAS = 'No pude cargar los planes. Revisa tu internet e intenta de nuevo.';
export const MENSAJE_OFERTAS_VACIAS =
  'Google Play no devolvió planes por ahora. Revisa tu conexión e intenta de nuevo.';

export const SUFIJO_PLUS = ' · Plus';
export const PISTA_ABRIR_PLANES = 'Abre los planes';
export const PISTA_VER_PLANES = 'Abre la pantalla Finanvoz Plus';
export const PISTA_ADMINISTRAR = 'Abre Google Play para administrar tu suscripción';
export const PISTA_RESTAURAR = 'Busca compras de Plus en tu cuenta de Google';
export const PISTA_INTENTAR = 'Vuelve a cargar los planes desde Google Play';

/** TalkBack al elegir mensual o anual (`02 §15`). */
export function pistaComprarOferta(o: OfertaPlus): string {
  if (o.diasPrueba) return 'Inicia la prueba gratis en Google Play';
  return o.periodo === 'mensual'
    ? 'Contrata Plus mensual en Google Play'
    : 'Contrata Plus anual en Google Play';
}

export function etiquetaCandadoPlus(texto: string): string {
  return `${texto}${SUFIJO_PLUS}`;
}

export function etiquetaAccesibilidadCandado(texto: string): string {
  return `${texto}. Disponible con Plus`;
}

/** Candado sin tienda: solo texto, sin botón que lleve a una oferta que no existe. */
export function etiquetaCandadoPlusPronto(texto: string): string {
  return `${texto}${SUFIJO_PLUS_PRONTO}`;
}

export function etiquetaAccesibilidadCandadoPronto(texto: string): string {
  return `${texto}. Llega con Plus; todavía no está disponible en esta versión`;
}

export const TITULO_PLAN_GRATIS = 'Plan Gratis';
export const TITULO_PLUS = 'Tienes Plus';
export const TITULO_PLUS_PRUEBA = 'Tienes Plus · prueba gratis';
export const MENSAJE_ERROR_COMPRA = 'No se completó la compra. No se te cobró nada; intenta de nuevo.';
export const MENSAJE_PENDIENTE =
  'Tu pago quedó pendiente en Google Play. Cuando se confirme, se activa Plus.';
export const MENSAJE_RESTAURADO_SIN_PLUS = 'No encontré una suscripción de Plus en tu cuenta de Google.';
export const MENSAJE_LISTO = 'Listo. Ya tienes Plus.';

/** TalkBack: compra o restauración fallida; el resto son avisos informativos. */
export function esMensajeErrorPlan(texto: string): boolean {
  return texto === MENSAJE_ERROR_COMPRA || texto === MENSAJE_ERROR_OFERTAS;
}

/** TalkBack: tarjeta «tu plan» y el resumen en Ajustes (`02 §15`). */
export function etiquetaAccesibleResumenPlan(titulo: string, detalle: string | null): string {
  const base = `Tu plan. ${titulo}`;
  return detalle ? `${base}. ${etiquetaHablada(detalle)}` : base;
}

/** TalkBack: precio bajo el botón de compra, con montos en palabras. */
export function etiquetaAccesibleOfertaDetalle(detalle: string): string {
  return etiquetaHablada(detalle);
}

/** TalkBack: aviso tras comprar, restaurar o error (montos en palabras si los hay). */
export function etiquetaAccesibleMensajePlan(mensaje: string): string {
  return etiquetaHablada(mensaje);
}

/** TalkBack: beneficio de la lista «Plus incluye». */
export function etiquetaAccesibleBeneficioPlus(texto: string): string {
  return etiquetaHablada(texto);
}

/** TalkBack: pie de la lista de beneficios (`02 §15`). */
export function etiquetaAccesibleIncluyeGratis(): string {
  return etiquetaHablada(INCLUYE_GRATIS);
}

/** "Tienes Plus · prueba gratis" y su detalle. */
export function resumenPlan(v: VistaPlan): { titulo: string; detalle: string | null } {
  if (v.plusDePrueba) return { titulo: TITULO_PLUS_DE_PRUEBA, detalle: TEXTO_PLUS_DE_PRUEBA };
  if (v.plan === 'plus') {
    const hasta = v.fechaFin ? etiquetaDiaMes(v.fechaFin) : null;
    if (v.enPrueba) {
      const dias = v.diasRestantes === 1 ? '1 día' : `${v.diasRestantes ?? 0} días`;
      return {
        titulo: TITULO_PLUS_PRUEBA,
        detalle: v.renovara
          ? `Te quedan ${dias} de prueba${hasta ? `; el ${hasta} empieza el cobro` : ''}.`
          : `Te quedan ${dias} de prueba. Cancelaste: no se te cobrará y después vuelves a Gratis.`,
      };
    }
    if (!hasta) return { titulo: TITULO_PLUS, detalle: null };
    return {
      titulo: TITULO_PLUS,
      detalle: v.renovara
        ? `Se renueva el ${hasta}.`
        : `Cancelaste: tienes Plus hasta el ${hasta} y después vuelves a Gratis.`,
    };
  }
  if (v.terminoPlus === 'prueba') {
    return {
      titulo: TITULO_PLAN_GRATIS,
      detalle:
        'Tu prueba de Plus terminó. Todo sigue aquí: tus datos siguen visibles, editables y puedes descargarlos.',
    };
  }
  if (v.terminoPlus === 'suscripcion') {
    return {
      titulo: TITULO_PLAN_GRATIS,
      detalle:
        'Tu suscripción a Plus terminó. Todo sigue aquí: tus datos siguen visibles, editables y puedes descargarlos.',
    };
  }
  return { titulo: TITULO_PLAN_GRATIS, detalle: null };
}

/** "Probar 14 días gratis" / "Mensual · $69.00 al mes". */
export function etiquetaOferta(o: OfertaPlus): { etiqueta: string; detalle: string } {
  const periodo = o.periodo === 'mensual' ? 'al mes' : 'al año';
  const nombre = o.periodo === 'mensual' ? 'Mensual' : 'Anual';
  if (o.diasPrueba) {
    return {
      etiqueta: `${nombre}: prueba ${o.diasPrueba} días gratis`,
      detalle: `Después, ${o.precio} ${periodo}. Cancela cuando quieras en Google Play.`,
    };
  }
  return {
    etiqueta: `${nombre} · ${o.precio} ${periodo}`,
    detalle: 'Cancela cuando quieras en Google Play.',
  };
}

/** CA-M7-02: el aviso al agotar las interpretaciones del mes. */
export const MENSAJE_LIMITE_MENSUAL_GRATIS = `Ya usaste las ${INTERPRETACIONES_NUBE_MES.gratis} frases que interpreto en internet este mes. La guardé en Por revisar. Las frases sencillas («tacos 80 en efectivo») siguen funcionando, y con Plus tienes ${INTERPRETACIONES_NUBE_MES.plus} al mes.`;
export const MENSAJE_LIMITE_MENSUAL_PLUS = `Ya usaste las ${INTERPRETACIONES_NUBE_MES.plus} frases que interpreto en internet este mes. La guardé en Por revisar. Las frases sencillas («tacos 80 en efectivo») siguen funcionando.`;
export const MENSAJE_LIMITE_DIARIO =
  'Ya usaste las frases que interpreto en internet por hoy. La guardé en Por revisar y la interpreto más tarde. Las frases sencillas («tacos 80 en efectivo») siguen funcionando.';

/** Mensaje al agotar un límite del intérprete; `null` para el tope global (el mensaje genérico basta). */
export function mensajeLimite(limite: CodigoLimite, plan: Plan): string | null {
  if (limite === 'limite_mensual')
    return plan === 'plus' ? MENSAJE_LIMITE_MENSUAL_PLUS : MENSAJE_LIMITE_MENSUAL_GRATIS;
  if (limite === 'limite_diario') return MENSAJE_LIMITE_DIARIO;
  return null;
}
