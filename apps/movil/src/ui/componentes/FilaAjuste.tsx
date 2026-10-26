import { View } from 'react-native';
import { etiquetaHablada } from '../formato';
import { espacio } from '../tokens';
import { Tarjeta } from './Tarjeta';
import { Texto, type TonoTexto } from './Texto';

export interface FilaAjusteProps {
  readonly titulo: string;
  /** Valor actual bajo el título (p. ej. «Último respaldo: hoy»). Nunca se corta: con letra grande crece. */
  readonly valor?: string | null;
  /** Tono del valor: `faltante` cuando pide atención (p. ej. respaldo pendiente). */
  readonly tonoValor?: TonoTexto;
  readonly alPresionar: () => void;
  /** VoiceOver y TalkBack: qué pasa al tocar (nunca digas «›»). */
  readonly pista: string;
  readonly testID: string;
  readonly testIDTitulo?: string;
  readonly testIDValor?: string;
  /** Si el título actúa como encabezado de sección (p. ej. Ingreso). */
  readonly tituloEsEncabezado?: boolean;
  /** Si no se pasa, el lector de pantalla lee título y valor completos. */
  readonly etiquetaAccesible?: string;
}

/**
 * Lo que lee el lector de pantalla: título, valor y (si se da) la acción, sin el chevron. El valor va completo
 * (quien no ve la pantalla oye lo mismo que se ve) y las cifras en palabras (`02 §15`).
 */
export function etiquetaFilaAjuste(titulo: string, valor?: string | null, accion?: string): string {
  const limpio = valor?.trim().replace(/[.\s]+$/, '');
  return etiquetaHablada([titulo, limpio, accion].filter((p): p is string => Boolean(p)).join('. '));
}

/**
 * Fila de Ajustes estilo lista (`PLAN-UX-VOZ` §3.6): título, valor opcional y ›.
 * El chevron es decorativo; la pista y la etiqueta llevan el significado. El valor no se trunca (CA-M7-05).
 */
export function FilaAjuste({
  titulo,
  valor,
  tonoValor = 'secundario',
  alPresionar,
  pista,
  testID,
  testIDTitulo,
  testIDValor,
  tituloEsEncabezado = false,
  etiquetaAccesible,
}: FilaAjusteProps) {
  const valorLimpio = valor?.trim() ? valor.trim() : null;
  const etiqueta = etiquetaAccesible ?? etiquetaFilaAjuste(titulo, valorLimpio);
  return (
    <Tarjeta testID={testID} alPresionar={alPresionar} etiquetaAccesible={etiqueta} pista={pista}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.m,
          minHeight: espacio.xxxl,
        }}
      >
        <View style={{ flex: 1, gap: espacio.xs }}>
          <Texto
            variante="subtitulo"
            {...(tituloEsEncabezado ? { accessibilityRole: 'header' as const } : {})}
            {...(testIDTitulo ? { testID: testIDTitulo } : {})}
          >
            {titulo}
          </Texto>
          {valorLimpio ? (
            <Texto variante="secundario" tono={tonoValor} {...(testIDValor ? { testID: testIDValor } : {})}>
              {valorLimpio}
            </Texto>
          ) : null}
        </View>
        <Texto variante="titulo" tono="secundario" accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Texto>
      </View>
    </Tarjeta>
  );
}
