import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
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
  /** Mínimo; si Android recomienda más tiempo (accesibilidad), se usa ese. */
  duracionMs?: number;
}

// Espacio que reservan las barras fijas al pie (p. ej. "Hablar" en Hoy) para que el aviso no las tape.
const reservas = new Map<number, number>();
const oyentesReservas = new Set<() => void>();
let ultimaReserva = 0;
const avisarReservas = () => oyentesReservas.forEach((f) => f());
const suscribirReservas = (f: () => void) => {
  oyentesReservas.add(f);
  return () => {
    oyentesReservas.delete(f);
  };
};
const espacioReservado = () => Math.max(0, ...reservas.values());

/** Sube el aviso `alto` dp mientras quien lo llama esté montado (una barra fija sobre las pestañas). */
export function useReservarEspacioAviso(alto: number) {
  useEffect(() => {
    if (alto <= 0) return;
    ultimaReserva += 1;
    const id = ultimaReserva;
    reservas.set(id, alto);
    avisarReservas();
    return () => {
      reservas.delete(id);
      avisarReservas();
    };
  }, [alto]);
}

function useLectorPantalla(): boolean {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (vigente) setActivo(v === true);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setActivo(v));
    return () => {
      vigente = false;
      sub.remove();
    };
  }, []);
  return activo;
}

function useDuracionRecomendada(minimo: number): number {
  const [ms, setMs] = useState(minimo);
  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.getRecommendedTimeoutMillis(minimo)
      .then((r: unknown) => {
        if (vigente) setMs(typeof r === 'number' && Number.isFinite(r) ? Math.max(minimo, r) : minimo);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [minimo]);
  return ms;
}

/**
 * Aviso inferior temporal con acción opcional "Deshacer" (RF-REG-04). Se cierra solo pasado el tiempo que pide
 * Android para leer y actuar (mínimo 10 s), al tocar la acción o al reemplazarse por otro aviso. Con lector de
 * pantalla no se cierra solo: muestra "Cerrar".
 */
export function Aviso({ aviso, alCerrar, duracionMs = DURACION_AVISO_MS }: AvisoProps) {
  const { c } = useTema();
  const lector = useLectorPantalla();
  const duracion = useDuracionRecomendada(duracionMs);
  const reservado = useSyncExternalStore(suscribirReservas, espacioReservado, () => 0);
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  }, [alCerrar]);
  const cerrar = useCallback(() => alCerrarRef.current(), []);

  const id = aviso?.id;
  useEffect(() => {
    if (id === undefined || lector) return;
    const t = setTimeout(() => alCerrarRef.current(), duracion);
    return () => clearTimeout(t);
  }, [id, duracion, lector]);

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
        bottom: espacio.l + reservado,
        minHeight: OBJETIVO_TACTIL_MIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        paddingLeft: espacio.l,
        paddingRight: accion || lector ? espacio.xs : espacio.l,
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
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[tipo.secundario, { color: c.sobreAviso }]}
        >
          {mensaje}
        </Text>
      </Pressable>
      {accion ? (
        <Pressable
          onPress={() => {
            accion.alPresionar();
            cerrar();
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
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[tipo.etiqueta, { color: c.avisoAccion }]}
          >
            {accion.etiqueta}
          </Text>
        </Pressable>
      ) : null}
      {lector ? (
        <Pressable
          testID="aviso-cerrar"
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
          style={{
            minHeight: OBJETIVO_TACTIL_MIN,
            minWidth: OBJETIVO_TACTIL_MIN,
            paddingHorizontal: espacio.m,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[tipo.etiqueta, { color: c.sobreAviso }]}
          >
            Cerrar
          </Text>
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
