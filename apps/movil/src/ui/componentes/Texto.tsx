import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { etiquetaHablada, tieneCifra } from '../formato';
import { useTema } from '../tema';
import { tipo, type VarianteTexto } from '../tokens';

export type TonoTexto = 'normal' | 'secundario' | 'acento' | 'faltante';

export interface TextoProps extends Omit<TextProps, 'style'> {
  variante?: VarianteTexto;
  tono?: TonoTexto;
  alinear?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}

/** Texto de `children` si son solo cadenas y números; `null` si hay elementos anidados. */
function textoPlano(children: ReactNode): string | null {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    let s = '';
    for (const h of children as unknown[]) {
      if (typeof h === 'string' || typeof h === 'number') s += String(h);
      else if (h !== null && h !== undefined && typeof h !== 'boolean') return null;
    }
    return s;
  }
  return null;
}

/**
 * Texto con la escala tipográfica; escala con la preferencia del sistema (texto al 200 %) y nunca se trunca.
 * Las cifras dentro del texto se anuncian en palabras.
 */
export function Texto({
  variante = 'cuerpo',
  tono = 'normal',
  alinear,
  style,
  children,
  ...resto
}: TextoProps) {
  const { c } = useTema();
  const color =
    tono === 'secundario'
      ? c.textoSecundario
      : tono === 'acento'
        ? c.acentoTexto
        : tono === 'faltante'
          ? c.faltante
          : c.texto;
  const encabezado = variante === 'titulo' || variante === 'subtitulo';
  // 02-UX §15: si el texto trae cifras ("Faltan $315."), TalkBack las lee en palabras.
  const plano = textoPlano(children);
  const hablado =
    resto.accessibilityLabel === undefined && plano !== null && tieneCifra(plano)
      ? { accessibilityLabel: etiquetaHablada(plano) }
      : {};
  return (
    <Text
      {...(encabezado ? { accessibilityRole: 'header' as const } : {})}
      {...hablado}
      {...resto}
      style={[tipo[variante], { color }, alinear ? { textAlign: alinear } : null, style]}
    >
      {children}
    </Text>
  );
}
