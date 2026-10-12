import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
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

/** Texto con la escala tipográfica; escala con la preferencia del sistema (texto al 200 %). */
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
  return (
    <Text
      {...(encabezado ? { accessibilityRole: 'header' as const } : {})}
      {...resto}
      style={[tipo[variante], { color }, alinear ? { textAlign: alinear } : null, style]}
    >
      {children}
    </Text>
  );
}
