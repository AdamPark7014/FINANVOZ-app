import {
  etiquetaDiaMes,
  INTERPRETACIONES_NUBE_MES,
  type CodigoLimite,
  type Plan,
  type VistaPlan,
} from '../../servicios';
import type { OfertaPlus } from '../../suscripciones/tipos';

/** Redacción del plan (`01 §11`, `02 §14`): tuteo, sin tecnicismos; los precios los pone la tienda. */

/** `testID` estables para pruebas y Maestro (`02 §12` Plan). */
export const ID = {
  pantalla: 'pantalla-plan',
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
  ajustesPlan: 'ajustes-plan',
  ajustesPlanTitulo: 'ajustes-plan-titulo',
  ajustesPlanDetalle: 'ajustes-plan-detalle',
  ajustesPlanVer: 'ajustes-plan-ver',
  puertaPlus: 'puerta-plus',
  puertaPlusConocer: 'puerta-plus-conocer',
} as const;

export const TITULO_PANTALLA = 'Finanvoz Plus';
export const SECCION_INCLUYE = 'Plus incluye';
export const SECCION_AJUSTES = 'Plan';
export const ETIQUETA_VOLVER = 'Volver';
export const ETIQUETA_VER_PLANES = 'Ver planes';
export const ETIQUETA_CONOCER_PLUS = 'Conocer Plus';
export const ETIQUETA_ADMINISTRAR = 'Administrar en Google Play';
export const ETIQUETA_RESTAURAR = 'Restaurar compras';
export const ETIQUETA_INTENTAR = 'Intentar de nuevo';
export const CARGANDO_OFERTAS = 'Cargando planes…';
export const NOTA_COMPRA_SIMULADA =
  'Compra simulada: esta build de desarrollo no tiene tienda y no cobra nada.';

/** Solo lo que ya existe en la app; lo que llega en hitos futuros no se promete aquí. */
export const INCLUYE_PLUS = [
  'Probabilidad de llegar a tu próximo pago sin tocar tu colchón',
  '«¿Me alcanza?»: compara pagar de contado, a meses o esperar',
  'Tarjeta del día: con cuál te conviene pagar hoy',
  'Tus meses sin intereses de los próximos 12 meses',
  'Pregúntame lo que quieras sobre tu dinero y te explico el porqué: cuánto llevas gastado, cuánto debes y qué pagos vienen',
  'Deducciones personales: con tus facturas, cuánto llevas deducible en el año y cuánto ISR podrías ahorrar',
  `${INTERPRETACIONES_NUBE_MES.plus} frases al mes interpretadas en internet (en Gratis, ${INTERPRETACIONES_NUBE_MES.gratis})`,
] as const;

export const INCLUYE_GRATIS =
  'Gratis siempre: tu «hoy puedes», captura de notificaciones, registro por voz, cuentas y tarjetas sin límite, avisos, arqueo, descargar y borrar tus datos.';

export const NOTA_TIENDA =
  'El cobro lo hace Google Play. Si cancelas antes de que termine la prueba, no se te cobra. Si no sigues con Plus, tu cuenta vuelve a Gratis y no pierdes ningún dato.';

export const MENSAJE_SIN_TIENDA = 'Las suscripciones todavía no están disponibles en esta versión.';
export const MENSAJE_ERROR_OFERTAS = 'No pude cargar los planes. Revisa tu internet e intenta de nuevo.';
export const MENSAJE_OFERTAS_VACIAS =
  'Google Play no devolvió planes por ahora. Revisa tu conexión e intenta de nuevo.';

export const SUFIJO_PLUS = ' · Plus';
export const PISTA_ABRIR_PLANES = 'Abre los planes';

export function etiquetaCandadoPlus(texto: string): string {
  return `${texto}${SUFIJO_PLUS}`;
}

export function etiquetaAccesibilidadCandado(texto: string): string {
  return `${texto}. Disponible con Plus`;
}

export const TITULO_PLAN_GRATIS = 'Plan Gratis';
export const TITULO_PLUS = 'Tienes Plus';
export const TITULO_PLUS_PRUEBA = 'Tienes Plus · prueba gratis';
export const MENSAJE_ERROR_COMPRA = 'No se completó la compra. No se te cobró nada; intenta de nuevo.';
export const MENSAJE_PENDIENTE =
  'Tu pago quedó pendiente en Google Play. Cuando se confirme, se activa Plus.';
export const MENSAJE_RESTAURADO_SIN_PLUS = 'No encontré una suscripción de Plus en tu cuenta de Google.';
export const MENSAJE_LISTO = 'Listo. Ya tienes Plus.';

/** "Tienes Plus · prueba gratis" y su detalle. */
export function resumenPlan(v: VistaPlan): { titulo: string; detalle: string | null } {
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
