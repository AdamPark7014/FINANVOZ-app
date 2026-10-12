import { useState } from 'react';
import {
  fijarContrasenaRespaldo,
  mensajeErrorRespaldo,
  MIN_CONTRASENA_RESPALDO,
  validarContrasenaNueva,
  type DependenciasRespaldo,
} from '../../servicios';
import { Boton, CampoTexto, Texto } from '../../ui';

/** Aviso antes de crear la contraseña (`02 §19`, `05 §E16`: "la UI lo dice antes de crearla"). */
export const AVISO_CONTRASENA =
  'Esta contraseña cifra tu respaldo. Ni nosotros la conocemos: si la olvidas, nadie puede recuperar tu respaldo.';

const NATIVO_CONTRASENA = {
  secureTextEntry: true,
  autoCapitalize: 'none',
  autoCorrect: false,
  autoComplete: 'new-password',
  textContentType: 'newPassword',
} as const;

/**
 * Crear o cambiar la contraseña del respaldo (mínimo 10 caracteres, se escribe dos veces). Al guardar, el
 * servicio deriva la llave (scrypt, tarda un par de segundos) y la guarda en el almacén seguro.
 */
export function FormularioContrasena({
  deps,
  cambiando,
  alGuardar,
  alCancelar,
}: {
  deps: Pick<DependenciasRespaldo, 'cripto' | 'almacen'>;
  cambiando: boolean;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const problema = validarContrasenaNueva(contrasena, confirmacion);
    if (problema) {
      setError(
        problema === 'corta'
          ? `Usa al menos ${MIN_CONTRASENA_RESPALDO} caracteres.`
          : 'Las contraseñas no coinciden.',
      );
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await fijarContrasenaRespaldo(deps, contrasena, confirmacion);
      setContrasena('');
      setConfirmacion('');
      alGuardar();
    } catch (e) {
      setError(
        e instanceof Error && 'codigo' in e
          ? mensajeErrorRespaldo(e)
          : 'No pude guardar la contraseña. Intenta de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Texto variante="cuerpo" testID="respaldo-aviso-contrasena">
        {AVISO_CONTRASENA}
      </Texto>
      {cambiando ? (
        <Texto variante="secundario" tono="secundario">
          Tus respaldos anteriores se siguen abriendo con la contraseña anterior.
        </Texto>
      ) : null}
      <CampoTexto
        testID="respaldo-contrasena"
        etiqueta={cambiando ? 'Contraseña nueva' : 'Contraseña del respaldo'}
        ayuda={`Al menos ${MIN_CONTRASENA_RESPALDO} caracteres. Una frase de varias palabras es fácil de recordar.`}
        valor={contrasena}
        alCambiar={setContrasena}
        nativo={NATIVO_CONTRASENA}
      />
      <CampoTexto
        testID="respaldo-contrasena-confirmar"
        etiqueta="Escríbela otra vez"
        valor={confirmacion}
        alCambiar={setConfirmacion}
        error={error}
        nativo={NATIVO_CONTRASENA}
        alEnviar={() => void guardar()}
      />
      <Boton
        testID="respaldo-contrasena-guardar"
        etiqueta="Guardar contraseña"
        cargando={guardando}
        deshabilitado={guardando || contrasena === '' || confirmacion === ''}
        alPresionar={() => void guardar()}
      />
      <Boton variante="texto" etiqueta="Cancelar" deshabilitado={guardando} alPresionar={alCancelar} />
    </>
  );
}
