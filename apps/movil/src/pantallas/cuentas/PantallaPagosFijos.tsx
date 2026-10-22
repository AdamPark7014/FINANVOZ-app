import { View } from 'react-native';
import { listarPagosFijos } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, EstadoVacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { capitalizar, describirRegla } from '../onboarding/pagos-fijos';
import { Encabezado } from './Encabezado';
import {
  BTN_AGREGAR_PAGO_FIJO,
  etiquetaFila,
  INTRO_PAGOS_FIJOS,
  PISTA_ABRIR_COMPROMISO,
  PISTA_AGREGAR_PAGO_FIJO,
  TEXTO_PAGOS_FIJOS_VACIO,
  textoProximoPago,
  TITULO_PAGOS_FIJOS,
} from './textos';

/**
 * Cuentas › Compromisos › Ver todos tus pagos fijos: la lista completa (también los anuales y los que caen en más
 * de 30 días), cada uno tocable para cambiar su monto o quitarlo, y «Agregar pago fijo».
 */
export function PantallaPagosFijos({
  alVolver,
  alAgregar,
  alAbrir,
}: {
  alVolver: () => void;
  alAgregar: () => void;
  alAbrir: (programadoId: string) => void;
}) {
  const pagos = useVista(listarPagosFijos);
  return (
    <Pantalla
      testID="pagos-fijos"
      bordes={['top', 'left', 'right', 'bottom']}
      pie={
        <Boton
          testID="pagos-fijos-agregar"
          etiqueta={BTN_AGREGAR_PAGO_FIJO}
          pista={PISTA_AGREGAR_PAGO_FIJO}
          alPresionar={alAgregar}
        />
      }
    >
      <Encabezado titulo={TITULO_PAGOS_FIJOS} alVolver={alVolver} testID="pagos-fijos" />
      <Texto variante="secundario" tono="secundario">
        {INTRO_PAGOS_FIJOS}
      </Texto>
      {pagos.length === 0 ? (
        <EstadoVacio texto={TEXTO_PAGOS_FIJOS_VACIO} testID="pagos-fijos-vacio" />
      ) : (
        <View accessibilityRole="list" testID="pagos-fijos-lista" style={{ gap: espacio.s }}>
          {pagos.map((p) => {
            const titulo = capitalizar(p.concepto);
            const regla = describirRegla(p.regla);
            const proximo = textoProximoPago(p.proxima);
            return (
              <View key={p.id} role="listitem" testID={`pago-fijo-${p.id}`}>
                <Tarjeta
                  alPresionar={() => alAbrir(p.id)}
                  etiquetaAccesible={etiquetaFila({
                    titulo,
                    subtitulo: `${regla}. ${proximo}`,
                    contexto: 'Apartas',
                    centavos: p.monto,
                  })}
                  pista={PISTA_ABRIR_COMPROMISO}
                  testID={`pago-fijo-${p.id}-abrir`}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
                    <View style={{ flex: 1, gap: espacio.xxs }}>
                      <Texto variante="cuerpoFuerte">{titulo}</Texto>
                      <Texto variante="secundario" tono="secundario">
                        {regla}
                      </Texto>
                      <Texto variante="secundario" tono="secundario">
                        {proximo}
                      </Texto>
                    </View>
                    <Cifra
                      centavos={p.monto}
                      contexto={`${titulo}, ${regla}`}
                      testID={`pago-fijo-${p.id}-monto`}
                    />
                  </View>
                </Tarjeta>
              </View>
            );
          })}
        </View>
      )}
    </Pantalla>
  );
}
