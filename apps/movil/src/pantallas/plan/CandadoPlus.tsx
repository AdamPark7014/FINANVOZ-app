import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { funcionesPlan, type FuncionesPlan } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, espacio, OBJETIVO_TACTIL_MIN, Tarjeta, Texto } from '../../ui';
import {
  ETIQUETA_CONOCER_PLUS,
  ETIQUETA_VOLVER,
  etiquetaAccesibilidadCandado,
  etiquetaAccesibilidadCandadoPronto,
  etiquetaAccesibleBeneficioPlus,
  etiquetaCandadoPlus,
  etiquetaCandadoPlusPronto,
  ID,
  PISTA_ABRIR_PLANES,
  PISTA_VOLVER,
  PUERTA_PLUS_SIN_TIENDA,
} from './textos';

/**
 * Candado discreto de una función de Plus (`02 §4`: "Ver probabilidad · Plus"). Tocarlo abre la pantalla del plan;
 * sin navegación (pruebas de una pantalla) es solo texto. Sin tienda (iPhone, build sin llave) no hay nada que
 * contratar: es solo texto ("· Plus, muy pronto"), nunca un botón que lleve a un callejón.
 */
export function CandadoPlus({ texto, testID }: { texto: string; testID?: string }) {
  const { abrirPlan, compras } = usePlanTienda();
  if (!compras) {
    return (
      <View
        {...(testID ? { testID } : {})}
        accessible
        accessibilityLabel={etiquetaAccesibilidadCandadoPronto(texto)}
      >
        <Texto variante="secundario" tono="secundario">
          {etiquetaCandadoPlusPronto(texto)}
        </Texto>
      </View>
    );
  }
  const contenido = (
    <Texto variante="secundario" tono="acento">
      {etiquetaCandadoPlus(texto)}
    </Texto>
  );
  if (!abrirPlan) {
    return <View {...(testID ? { testID } : {})}>{contenido}</View>;
  }
  return (
    <Pressable
      {...(testID ? { testID } : {})}
      onPress={abrirPlan}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesibilidadCandado(texto)}
      accessibilityHint={PISTA_ABRIR_PLANES}
      style={{ minHeight: OBJETIVO_TACTIL_MIN, justifyContent: 'center' }}
    >
      {contenido}
    </Pressable>
  );
}

type Funcion = Exclude<keyof FuncionesPlan, 'interpretacionesNubeMes'>;

/**
 * Muestra `children` si el plan incluye la función; si no, una tarjeta que lo explica y lleva al plan. Nunca oculta
 * datos: solo funciones de análisis (`01 §11`). Sin tienda no hay "Conocer Plus" ni invitación a probarlo: solo
 * dice que llega pronto (y "Volver", si la puerta ocupa la pantalla). `enLinea`: tarjeta dentro de una pantalla
 * (p. ej. la estimación de Deducciones) en vez de ocupar la pantalla entera.
 */
export function PuertaPlus({
  funcion,
  titulo,
  descripcion,
  invitacion,
  alVolver,
  enLinea = false,
  children,
}: {
  funcion: Funcion;
  titulo: string;
  descripcion: string;
  /** Solo con tienda: "Pruébalo 14 días gratis." */
  invitacion?: string;
  alVolver?: () => void;
  enLinea?: boolean;
  children: ReactNode;
}) {
  const funciones = useVista(funcionesPlan);
  const { abrirPlan, compras } = usePlanTienda();
  if (funciones[funcion]) return <>{children}</>;
  const texto = compras && invitacion ? `${descripcion} ${invitacion}` : descripcion;
  const tarjeta = (
    <Tarjeta {...(enLinea ? { testID: ID.puertaPlus } : {})}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {titulo}
      </Texto>
      <Texto variante="cuerpo" tono="secundario" accessibilityLabel={etiquetaAccesibleBeneficioPlus(texto)}>
        {texto}
      </Texto>
      {!compras ? (
        <Texto variante="secundario" tono="secundario" testID={ID.puertaPlusPronto}>
          {PUERTA_PLUS_SIN_TIENDA}
        </Texto>
      ) : abrirPlan ? (
        <Boton
          etiqueta={ETIQUETA_CONOCER_PLUS}
          alPresionar={abrirPlan}
          pista={PISTA_ABRIR_PLANES}
          testID={ID.puertaPlusConocer}
        />
      ) : null}
      {alVolver ? (
        <Boton
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          alPresionar={alVolver}
          pista={PISTA_VOLVER}
          testID={ID.volver}
        />
      ) : null}
    </Tarjeta>
  );
  if (enLinea) return tarjeta;
  return (
    <View
      style={{ flex: 1, padding: espacio.l, gap: espacio.l, justifyContent: 'center' }}
      testID={ID.puertaPlus}
    >
      {tarjeta}
    </View>
  );
}
