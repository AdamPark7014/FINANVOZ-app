import type { FamiliaCategoria } from '../tokens';
import type { NombreIcono } from './Iconos';
import { etiquetaFilaAjuste, Fila } from './Lista';
import type { TonoTexto } from './Texto';

export { etiquetaFilaAjuste };

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
  /** Mosaico de color a la izquierda (pase de pulido, 22-11). */
  readonly icono?: NombreIcono;
  readonly familia?: FamiliaCategoria;
}

/**
 * Fila de Ajustes (`PLAN-UX-VOZ` §3.6) dentro de un `Grupo`: mosaico, título, valor debajo y chevron. El chevron es
 * decorativo; la pista y la etiqueta llevan el significado. El valor no se trunca (CA-M7-05).
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
  icono,
  familia,
}: FilaAjusteProps) {
  const valorLimpio = valor?.trim() ? valor.trim() : null;
  return (
    <Fila
      testID={testID}
      titulo={titulo}
      apoyo={valorLimpio}
      tonoApoyo={tonoValor}
      alPresionar={alPresionar}
      pista={pista}
      tituloEncabezado={tituloEsEncabezado}
      etiquetaAccesible={etiquetaAccesible ?? etiquetaFilaAjuste(titulo, valorLimpio)}
      {...(icono ? { icono } : {})}
      {...(familia ? { familia } : {})}
      {...(testIDTitulo ? { testIDTitulo } : {})}
      {...(testIDValor ? { testIDApoyo: testIDValor } : {})}
    />
  );
}
