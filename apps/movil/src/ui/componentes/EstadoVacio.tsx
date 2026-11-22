import { StyleSheet, View } from 'react-native';
import { etiquetaEstadoVacio } from '../formato';
import { useTema } from '../tema';
import { espacio, radio } from '../tokens';
import { Icono, type NombreIcono } from './Iconos';
import { Texto } from './Texto';

/**
 * Copy secundario cuando una sección no tiene filas (`02 §10`, `02 §11`).
 * Convención es-MX: listas sin datos → «Todavía no…»; neutros → «No hay…» / «No debes…» en los `textos.ts` de cada pantalla.
 * TalkBack (`etiquetaEstadoVacio`): cifras en palabras y «Todavía…» al inicio se oye «Aún…»;
 * live region al aparecer; `pistaCta` señala el botón principal debajo.
 */
export function EstadoVacio({
  texto,
  testID,
  etiquetaAccesible,
  pistaCta,
  icono,
  titulo,
}: {
  texto: string;
  /**
   * Con ícono (pase de pulido, 22-11), el vacío se dibuja como invitación: el ícono en un círculo menta, un título
   * corto y el texto debajo, sobre la tarjeta. Sin ícono, la caja gris de siempre.
   */
  icono?: NombreIcono;
  /** Título corto arriba del texto (solo con `icono`). */
  titulo?: string;
  testID: string;
  /** Incluye el título de sección para TalkBack (p. ej. «Tienes. …»). */
  etiquetaAccesible?: string;
  /** Pista del CTA justo debajo (p. ej. «Más abajo, botón Nueva tanda»). */
  pistaCta?: string;
}) {
  const { c } = useTema();
  if (icono) {
    return (
      <View
        style={{
          paddingVertical: espacio.xxl,
          paddingHorizontal: espacio.xl,
          borderRadius: radio.xl,
          backgroundColor: c.superficie,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.borde,
          alignItems: 'center',
          gap: espacio.s,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: c.iconoFondo,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: espacio.s,
          }}
        >
          <Icono nombre={icono} color={c.acentoTexto} tamano={28} grosor={1.8} />
        </View>
        {titulo ? (
          <Texto
            variante="subtitulo"
            alinear="center"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {titulo}
          </Texto>
        ) : null}
        <Texto
          variante="secundario"
          tono="secundario"
          alinear="center"
          testID={testID}
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            etiquetaAccesible ??
            (titulo ? `${titulo}. ${etiquetaEstadoVacio(texto)}` : etiquetaEstadoVacio(texto))
          }
          {...(pistaCta === undefined ? {} : { accessibilityHint: pistaCta })}
          style={{ maxWidth: 300 }}
        >
          {texto}
        </Texto>
      </View>
    );
  }
  return (
    <View
      style={{
        paddingVertical: espacio.xxl,
        paddingHorizontal: espacio.xl,
        borderRadius: radio.xl,
        backgroundColor: c.superficieAlterna,
        gap: espacio.m,
      }}
    >
      <Texto
        variante="cuerpo"
        tono="secundario"
        alinear="center"
        testID={testID}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={etiquetaAccesible ?? etiquetaEstadoVacio(texto)}
        {...(pistaCta === undefined ? {} : { accessibilityHint: pistaCta })}
      >
        {texto}
      </Texto>
    </View>
  );
}
