import { View } from 'react-native';
import { listarPersonas } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Cifra, espacio, EstadoVacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { Encabezado } from './Encabezado';
import {
  estadoPersona,
  etiquetaPersona,
  INTRO_PERSONAS,
  PISTA_ABRIR_PERSONA,
  TEXTO_PERSONAS_VACIO,
  TITULO_PERSONAS,
} from './textos';

/**
 * Cuentas › Personas (`02 §17`): todas las personas, también con las que ya están a mano (Cuentas solo enseña a
 * quién le debes y quién te debe). Cada una abre su ficha (`/persona/[id]`).
 */
export function PantallaPersonas({
  alVolver,
  alAbrirPersona,
}: {
  alVolver: () => void;
  alAbrirPersona: (personaId: string) => void;
}) {
  const personas = useVista(listarPersonas);
  return (
    <Pantalla testID="personas" bordes={['top', 'left', 'right', 'bottom']}>
      <Encabezado titulo={TITULO_PERSONAS} alVolver={alVolver} testID="personas" />
      <Texto variante="secundario" tono="secundario">
        {INTRO_PERSONAS}
      </Texto>
      {personas.length === 0 ? (
        <EstadoVacio texto={TEXTO_PERSONAS_VACIO} testID="personas-vacio" />
      ) : (
        <View accessibilityRole="list" testID="personas-lista" style={{ gap: espacio.s }}>
          {personas.map((p) => (
            <View key={p.cuentaId} role="listitem" testID={`persona-${p.cuentaId}`}>
              <Tarjeta
                alPresionar={() => alAbrirPersona(p.cuentaId)}
                etiquetaAccesible={etiquetaPersona(p.nombre, p.saldo)}
                pista={PISTA_ABRIR_PERSONA}
                testID={`persona-${p.cuentaId}-abrir`}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
                  <View style={{ flex: 1, gap: espacio.xxs }}>
                    <Texto variante="cuerpoFuerte">{p.nombre}</Texto>
                    <Texto variante="secundario" tono="secundario">
                      {estadoPersona(p.saldo)}
                    </Texto>
                  </View>
                  {p.saldo !== 0 ? (
                    <Cifra centavos={Math.abs(p.saldo)} testID={`persona-${p.cuentaId}-saldo`} />
                  ) : null}
                </View>
              </Tarjeta>
            </View>
          ))}
        </View>
      )}
    </Pantalla>
  );
}
