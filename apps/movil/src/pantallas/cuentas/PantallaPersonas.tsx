import { View } from 'react-native';
import { listarPersonas } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Cifra, espacio, EstadoVacio, Pantalla, Texto } from '../../ui';
import { Fila, Grupo, Inicial } from '../../ui/componentes/Lista';
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
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
  alAbrirPersona: (personaId: string) => void;
}) {
  const personas = useVista(listarPersonas);
  return (
    <Pantalla
      testID="personas"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      <Encabezado titulo={TITULO_PERSONAS} {...(alVolver ? { alVolver } : {})} testID="personas" />
      <Texto variante="cuerpo" tono="secundario" style={{ marginTop: -espacio.m }}>
        {INTRO_PERSONAS}
      </Texto>
      {personas.length === 0 ? (
        <EstadoVacio icono="personas" texto={TEXTO_PERSONAS_VACIO} testID="personas-vacio" />
      ) : (
        <View accessibilityRole="list" testID="personas-lista">
          <Grupo sangria={40}>
            {personas.map((p) => (
              <View key={p.cuentaId} role="listitem" testID={`persona-${p.cuentaId}`}>
                <Fila
                  testID={`persona-${p.cuentaId}-abrir`}
                  inicio={<Inicial nombre={p.nombre} />}
                  titulo={p.nombre}
                  apoyo={estadoPersona(p.saldo)}
                  etiquetaAccesible={etiquetaPersona(p.nombre, p.saldo)}
                  pista={PISTA_ABRIR_PERSONA}
                  alPresionar={() => alAbrirPersona(p.cuentaId)}
                  {...(p.saldo !== 0
                    ? {
                        derecha: (
                          <Cifra centavos={Math.abs(p.saldo)} testID={`persona-${p.cuentaId}-saldo`} />
                        ),
                      }
                    : {})}
                />
              </View>
            ))}
          </Grupo>
        </View>
      )}
    </Pantalla>
  );
}
