import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { DURACION_AVISO_MS, espacio, OBJETIVO_TACTIL_MIN, radio, tipo } from '../tokens';

export interface AccionAviso {
  /** "Deshacer" (02-UX §1.3). */
  etiqueta: string;
  alPresionar: () => void;
}

export interface DatosAviso {
  /** Identifica cada aviso para reiniciar el temporizador aunque el texto se repita. */
  id: string | number;
  /** "Registré: Coca $25 · Antojos · Efectivo" — ya redactado por quien lo muestra. */
  mensaje: string;
  accion?: AccionAviso;
  /** Tocar el mensaje (p. ej. abrir la edición del movimiento). */
  alPresionarMensaje?: () => void;
}

export interface AvisoProps {
  aviso: DatosAviso | null;
  alCerrar: () => void;
  duracionMs?: number;
}

/**
 * Aviso inferior temporal con acción opcional "Deshacer". Se cierra solo a los 5 s
 * (RF-REG-04), al tocar la acción o al reemplazarse por otro aviso.
 */
export function Aviso({ aviso, alCerrar, duracionMs = DURACION_AVISO_MS }: AvisoProps) {
  const { c } = useTema();
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  }, [alCerrar]);

  const id = aviso?.id;
  useEffect(() => {
    if (id === undefined) return;
    const t = setTimeout(() => alCerrarRef.current(), duracionMs);
    return () => clearTimeout(t);
  }, [id, duracionMs]);

  if (!aviso) return null;
  const { mensaje, accion, alPresionarMensaje } = aviso;
  return (
    <View
      testID="aviso"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: espacio.l,
        right: espacio.l,
        bottom: espacio.l,
        minHeight: OBJETIVO_TACTIL_MIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        paddingLeft: espacio.l,
        paddingRight: accion ? espacio.xs : espacio.l,
        paddingVertical: espacio.xs,
        borderRadius: radio.m,
        backgroundColor: c.aviso,
      }}
    >
      <Pressable
        onPress={alPresionarMensaje}
        disabled={!alPresionarMensaje}
        accessibilityRole={alPresionarMensaje ? 'button' : 'text'}
        accessibilityLabel={etiquetaHablada(mensaje)}
        {...(alPresionarMensaje ? { accessibilityHint: 'Abre el detalle para editarlo' } : {})}
        style={{ flex: 1, minHeight: OBJETIVO_TACTIL_MIN, justifyContent: 'center' }}
      >
        <Text style={[tipo.secundario, { color: c.sobreAviso }]}>{mensaje}</Text>
      </Pressable>
      {accion ? (
        <Pressable
          onPress={() => {
            accion.alPresionar();
            alCerrarRef.current();
          }}
          accessibilityRole="button"
          accessibilityLabel={accion.etiqueta}
          style={{
            minHeight: OBJETIVO_TACTIL_MIN,
            minWidth: OBJETIVO_TACTIL_MIN,
            paddingHorizontal: espacio.m,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={[tipo.etiqueta, { color: c.avisoAccion }]}>{accion.etiqueta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Estado de un aviso a la vez: el nuevo reemplaza al anterior. */
export function useAviso() {
  const [aviso, setAviso] = useState<DatosAviso | null>(null);
  const contador = useRef(0);
  const mostrar = useCallback((datos: Omit<DatosAviso, 'id'>) => {
    contador.current += 1;
    setAviso({ ...datos, id: contador.current });
  }, []);
  const cerrar = useCallback(() => setAviso(null), []);
  return { aviso, mostrar, cerrar };
}
