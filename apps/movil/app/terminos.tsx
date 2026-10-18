import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { RESPONSABLE, type SeccionAviso } from '../src/pantallas/onboarding/aviso';
import { TEXTO_NO_ASESORIA, VERSION_TERMINOS } from '../src/pantallas/privacidad/legales';
import { Boton, espacio, Pantalla, Texto } from '../src/ui';

/** Resumen de `08 §1` en pantalla; el detalle legal sigue en `legales.ts` para otros usos. */
const TERMINOS_CORTO: readonly SeccionAviso[] = [
  {
    titulo: 'Qué es Finanvoz',
    parrafos: [
      'Registras y revisas tus finanzas con lo que capturas o llega a tu teléfono. Te damos estimaciones con tu historial.',
    ],
  },
  {
    titulo: 'Qué no es',
    parrafos: [
      TEXTO_NO_ASESORIA,
      'Finanvoz no mueve dinero, no ofrece crédito, no recomienda valores ni se conecta a tus cuentas con tus claves del banco. Las decisiones sobre tu dinero son tuyas.',
    ],
  },
  {
    titulo: 'Tus datos y planes',
    parrafos: [
      'Tus datos viven cifrados en tu teléfono; puedes exportarlos o borrarlos gratis en Privacidad. Registrar y descargar es gratis; Plus agrega análisis y preguntas abiertas con resúmenes agregados, no tu libro completo.',
    ],
  },
  {
    titulo: 'Beta y contacto',
    parrafos: [
      'Esta es una versión beta: puede tener errores; escríbenos si algo no cuadra.',
      `${RESPONSABLE.nombre}. ${RESPONSABLE.domicilio}. ${RESPONSABLE.correo}.`,
    ],
  },
];

/** Términos de uso (`08 §1`, checklist §7.1), desde el centro de privacidad y Ajustes. Solo lectura. */
export default function Terminos() {
  const router = useRouter();
  return (
    <Pantalla testID="terminos" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton variante="texto" ancho="contenido" etiqueta="Volver" alPresionar={() => router.back()} />
      <Texto variante="titulo">Términos de uso</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Versión ${VERSION_TERMINOS}`}
      </Texto>
      {TERMINOS_CORTO.map((s) => (
        <View key={s.titulo} style={{ gap: espacio.s }}>
          <Texto variante="subtitulo">{s.titulo}</Texto>
          {s.parrafos.map((p) => (
            <Texto key={p} variante="cuerpo">
              {p}
            </Texto>
          ))}
        </View>
      ))}
    </Pantalla>
  );
}
