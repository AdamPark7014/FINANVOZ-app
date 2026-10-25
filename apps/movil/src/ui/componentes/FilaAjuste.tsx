import { View } from 'react-native';
import { espacio } from '../tokens';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

export interface FilaAjusteProps {
  readonly titulo: string;
  /** Valor actual a la derecha del título (p. ej. «Último respaldo: hoy»). */
  readonly valor?: string | null;
  readonly alPresionar: () => void;
  /** TalkBack: qué pasa al tocar (nunca digas «›»). */
  readonly pista: string;
  readonly testID: string;
  readonly testIDTitulo?: string;
  readonly testIDValor?: string;
  /** Si el título actúa como encabezado de sección (p. ej. Ingreso). */
  readonly tituloEsEncabezado?: boolean;
  /** Si no se pasa, TalkBack lee título y valor. */
  readonly etiquetaAccesible?: string;
}

/**
 * Fila de Ajustes estilo lista (`PLAN-UX-VOZ` §3.6): título, valor opcional y ›.
 * El chevron es decorativo; la pista y la etiqueta llevan el significado.
 */
export function FilaAjuste({
  titulo,
  valor,
  alPresionar,
  pista,
  testID,
  testIDTitulo,
  testIDValor,
  tituloEsEncabezado = false,
  etiquetaAccesible,
}: FilaAjusteProps) {
  const valorLimpio = valor?.trim() ? valor.trim() : null;
  const etiqueta =
    etiquetaAccesible ?? (valorLimpio ? `${titulo}. ${valorLimpio}` : titulo);
  return (
    <Tarjeta
      testID={testID}
      alPresionar={alPresionar}
      etiquetaAccesible={etiqueta}
      pista={pista}
    >
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
            <Texto
              variante="secundario"
              tono="secundario"
              numberOfLines={2}
              {...(testIDValor ? { testID: testIDValor } : {})}
            >
              {valorLimpio}
            </Texto>
          ) : null}
        </View>
        <Texto
          variante="titulo"
          tono="secundario"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ›
        </Texto>
      </View>
    </Tarjeta>
  );
}
