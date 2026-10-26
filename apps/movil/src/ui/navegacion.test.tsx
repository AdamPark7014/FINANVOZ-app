import { ETIQUETA_ATRAS, opcionesBarraNativa } from './navegacion';
import { colores } from './tokens';

describe('barra nativa del Stack (`PLAN-UX-VOZ` 3.3)', () => {
  it.each(['claro', 'oscuro'] as const)(
    'en modo %s toma los colores del tema, solo muestra el chevron y no repite el título',
    (esquema) => {
      const c = colores[esquema];
      const o = opcionesBarraNativa(c);
      // Sin colores la barra salía con el tema por omisión de React Navigation (clara también en modo oscuro).
      expect(o.headerStyle.backgroundColor).toBe(c.fondo);
      expect(o.contentStyle.backgroundColor).toBe(c.fondo);
      expect(o.headerTintColor).toBe(c.acentoTexto);
      // Solo el chevron; VoiceOver dice «Atrás» en lugar del nombre interno de la ruta («(tabs)»).
      expect(o.headerBackButtonDisplayMode).toBe('minimal');
      expect(o.headerBackTitle).toBe(ETIQUETA_ATRAS);
      // El título grande de iOS se encimaba con el contenido; el encabezado vive en la pantalla.
      expect(o.headerLargeTitle).toBe(false);
      expect(o.headerTransparent).toBe(false);
      expect(o.title).toBe('');
      // Cadena vacía, no función: en Android una función monta una vista izquierda que esconde la flecha.
      expect(o.headerTitle).toBe('');
    },
  );

  it('el claro y el oscuro no comparten fondo', () => {
    expect(opcionesBarraNativa(colores.claro).headerStyle.backgroundColor).not.toBe(
      opcionesBarraNativa(colores.oscuro).headerStyle.backgroundColor,
    );
  });
});
