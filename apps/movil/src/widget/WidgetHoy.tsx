'use no memo';
// La biblioteca recorre el árbol llamando a los componentes como funciones: sin hooks ni React Compiler.
import { FlexWidget, TextWidget, type HexColor } from 'react-native-android-widget';
import type { VistaWidget } from '../servicios';
import { colores, type EsquemaColor } from '../ui/tokens';
import { detalleConSeparador, etiquetaAccesibleWidget, tamanoFuenteCifra } from './formatoWidget';

/** Nombre del widget en `app.json` (config plugin) y al pedir una actualización. */
export const NOMBRE_WIDGET = 'HoyPuedes';

const hex = (c: string) => c as HexColor;

/**
 * Widget 2×1 "Hoy puedes **$214** · 4 días" (`02 §21`). Sin lógica: pinta la `VistaWidget` de servicios. Todo el
 * widget es un solo toque que abre la app en Hoy; la etiqueta accesible es la línea completa con la cifra en
 * palabras (`02 §15`, pase de M13).
 */
export function WidgetHoy({ vista, esquema }: { vista: VistaWidget; esquema: EsquemaColor }) {
  const c = colores[esquema];
  const texto = { color: hex(c.texto), fontSize: 16 } as const;
  const tamCifra = vista.cifra ? tamanoFuenteCifra(vista.cifra) : 22;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: vista.enlace }}
      accessibilityLabel={etiquetaAccesibleWidget(vista)}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexGap: 6,
        paddingHorizontal: 16,
        backgroundColor: hex(c.superficie),
        borderRadius: 16,
      }}
    >
      {vista.cifra !== null && vista.titulo !== null && vista.detalle !== null ? (
        [
          <TextWidget key="titulo" text={vista.titulo} style={texto} />,
          <TextWidget
            key="cifra"
            text={vista.cifra}
            style={{ color: hex(c.acentoTexto), fontSize: tamCifra, fontWeight: 'bold' }}
          />,
          <TextWidget
            key="detalle"
            text={detalleConSeparador(vista.detalle) ?? ''}
            style={{ color: hex(c.textoSecundario), fontSize: 16 }}
          />,
        ]
      ) : (
        <TextWidget text={vista.texto} style={texto} maxLines={2} />
      )}
    </FlexWidget>
  );
}
