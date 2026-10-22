import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ERROR_GUARDAR,
  MensajeError,
  OMITIR_CAPTURA_ONB,
  PasoOnboarding,
} from '../../src/pantallas/onboarding/componentes';
import { describirRegla, totalMensual } from '../../src/pantallas/onboarding/pagos-fijos';
import {
  AYUDA_PAGOS_FIJOS,
  BTN_ONB_CONTINUAR,
  BTN_ONB_SALTAR,
  BTN_PAGO_QUITAR,
  etiquetaFilaPago,
  etiquetaPagosSuman,
  PISTA_PAGOS_CONTINUAR,
  PISTA_PAGOS_SALTAR,
  pistaQuitarPago,
  TEXTO_PAGOS_SUMAN,
  TIP_PAGOS_SALTAR,
  TITULO_PAGOS_FIJOS,
} from '../../src/pantallas/onboarding/textos';
import { FormularioPagoFijo, type PagoAgregado } from '../../src/pantallas/pagos-fijos/FormularioPagoFijo';
import { etiquetaFecha, quitarPagoFijo } from '../../src/servicios';
import { useSesion } from '../../src/sesion/ProveedorSesion';
import { Boton, Cifra, cifraEnPalabras, espacio, etiquetaHablada, Texto } from '../../src/ui';

/**
 * O5 · Pagos fijos (`02 §3`): el formulario (`FormularioPagoFijo`) agrega uno a la vez; la lista deja quitar y dice
 * cuánto suman al mes.
 */
export default function PagosFijos() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const [agregados, setAgregados] = useState<PagoAgregado[]>([]);
  const [error, setError] = useState<string | null>(null);

  const quitar = (p: PagoAgregado) => {
    try {
      quitarPagoFijo(ctx, p.id);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setAgregados((a) => a.filter((x) => x.id !== p.id));
    setError(null);
    refrescar();
  };

  const total = totalMensual(agregados);

  return (
    <PasoOnboarding
      testID="onb-pagos-fijos"
      paso={5}
      titulo={TITULO_PAGOS_FIJOS}
      ayuda={AYUDA_PAGOS_FIJOS}
      tip={TIP_PAGOS_SALTAR}
      pie={
        <Boton
          testID="onb-pagos-continuar"
          etiqueta={agregados.length > 0 ? BTN_ONB_CONTINUAR : BTN_ONB_SALTAR}
          variante={agregados.length > 0 ? 'primario' : 'secundario'}
          pista={agregados.length > 0 ? PISTA_PAGOS_CONTINUAR : PISTA_PAGOS_SALTAR}
          alPresionar={() => router.push(OMITIR_CAPTURA_ONB ? '/onboarding/colchon' : '/onboarding/captura')}
        />
      }
    >
      <FormularioPagoFijo alAgregado={(p) => setAgregados((a) => [...a, p])} />
      {agregados.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="onb-pagos-lista">
          {agregados.map((p) => {
            const regla = describirRegla(p.regla);
            const fin = p.hasta ? etiquetaFecha(p.hasta) : null;
            const detalle = [regla, p.cuenta ? `sale de ${p.cuenta}` : null, fin ? `hasta ${fin}` : null]
              .filter((x): x is string => x !== null)
              .join(' · ');
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                <View
                  testID={`onb-pago-agregado-${p.id}`}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={etiquetaHablada(
                    etiquetaFilaPago({
                      concepto: p.concepto,
                      regla,
                      montoEnPalabras: cifraEnPalabras(p.monto),
                      cuenta: p.cuenta,
                      fin,
                    }),
                  )}
                  style={{ flex: 1, gap: espacio.xs }}
                >
                  <View
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                  >
                    <Texto variante="cuerpo">{p.concepto}</Texto>
                    <Cifra centavos={p.monto} contexto={`${p.concepto}, ${regla}`} />
                  </View>
                  <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Texto variante="secundario">{detalle}</Texto>
                  </View>
                </View>
                <Boton
                  testID={`onb-pago-quitar-${p.id}`}
                  variante="secundario"
                  ancho="contenido"
                  etiqueta={BTN_PAGO_QUITAR}
                  pista={pistaQuitarPago(p.concepto)}
                  alPresionar={() => quitar(p)}
                />
              </View>
            );
          })}
          <View
            testID="onb-pagos-total"
            accessible
            accessibilityRole="text"
            accessibilityLabel={etiquetaHablada(etiquetaPagosSuman(cifraEnPalabras(total)))}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Texto variante="etiqueta">{TEXTO_PAGOS_SUMAN}</Texto>
              <Cifra centavos={total} contexto={TEXTO_PAGOS_SUMAN} />
            </View>
          </View>
        </View>
      ) : null}
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
