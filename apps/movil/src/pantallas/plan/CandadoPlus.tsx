import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { funcionesPlan, type FuncionesPlan } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, espacio, OBJETIVO_TACTIL_MIN, Tarjeta, Texto } from '../../ui';

/**
 * Candado discreto de una función de Plus (`02 §4`: "Ver probabilidad · Plus"). Tocarlo abre la pantalla del plan;
 * sin navegación (pruebas de una pantalla) es solo texto.
 */
export function CandadoPlus({ texto, testID }: { texto: string; testID?: string }) {
  const { abrirPlan } = usePlanTienda();
  const contenido = (
    <Texto variante="secundario" tono="acento">
      {`${texto} · Plus`}
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
      accessibilityLabel={`${texto}. Disponible con Plus`}
      accessibilityHint="Abre los planes"
      style={{ minHeight: OBJETIVO_TACTIL_MIN, justifyContent: 'center' }}
    >
      {contenido}
    </Pressable>
  );
}

type Funcion = Exclude<keyof FuncionesPlan, 'interpretacionesNubeMes'>;

/**
 * Muestra `children` si el plan incluye la función; si no, una tarjeta que lo explica y lleva al plan. Nunca oculta
 * datos: solo funciones de análisis (`01 §11`).
 */
export function PuertaPlus({
  funcion,
  titulo,
  descripcion,
  alVolver,
  children,
}: {
  funcion: Funcion;
  titulo: string;
  descripcion: string;
  alVolver?: () => void;
  children: ReactNode;
}) {
  const funciones = useVista(funcionesPlan);
  const { abrirPlan } = usePlanTienda();
  if (funciones[funcion]) return <>{children}</>;
  return (
    <View
      style={{ flex: 1, padding: espacio.l, gap: espacio.l, justifyContent: 'center' }}
      testID="puerta-plus"
    >
      <Tarjeta>
        <Texto variante="subtitulo">{titulo}</Texto>
        <Texto variante="cuerpo" tono="secundario">
          {descripcion}
        </Texto>
        {abrirPlan ? (
          <Boton etiqueta="Conocer Plus" alPresionar={abrirPlan} testID="puerta-plus-conocer" />
        ) : null}
        {alVolver ? <Boton etiqueta="Volver" variante="texto" alPresionar={alVolver} /> : null}
      </Tarjeta>
    </View>
  );
}
