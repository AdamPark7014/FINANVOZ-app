import { useState } from 'react';
import { View } from 'react-native';
import { fijarContrasenaRespaldo, validarContrasenaNueva, type DependenciasRespaldo } from '../../servicios';
import { Boton, CampoTexto, espacio, Texto } from '../../ui';
import {
  AVISO_CONTRASENA,
  ayudaContrasena,
  BTN_CANCELAR,
  BTN_GUARDAR_CONTRASENA,
  errorContrasenaCorta,
  ERROR_CONTRASENAS_NO_COINCIDEN,
  ETIQUETA_CONFIRMAR_CONTRASENA,
  ETIQUETA_CONTRASENA,
  ETIQUETA_CONTRASENA_NUEVA,
  mensajeErrorRespaldo,
  MENSAJE_NO_GUARDAR_CONTRASENA,
  PISTA_CANCELAR_CONTRASENA,
  PISTA_GUARDAR_CONTRASENA,
  TEXTO_RESPALDOS_ANTERIORES,
} from './textos';

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
      setError(problema === 'corta' ? errorContrasenaCorta() : ERROR_CONTRASENAS_NO_COINCIDEN);
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
      setError(e instanceof Error && 'codigo' in e ? mensajeErrorRespaldo(e) : MENSAJE_NO_GUARDAR_CONTRASENA);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={{ gap: espacio.m }} testID="respaldo-formulario-contrasena">
      <Texto variante="cuerpo" testID="respaldo-aviso-contrasena" accessibilityRole="alert">
        {AVISO_CONTRASENA}
      </Texto>
      {cambiando ? (
        <Texto variante="secundario" tono="secundario">
          {TEXTO_RESPALDOS_ANTERIORES}
        </Texto>
      ) : null}
      <CampoTexto
        testID="respaldo-contrasena"
        etiqueta={cambiando ? ETIQUETA_CONTRASENA_NUEVA : ETIQUETA_CONTRASENA}
        ayuda={ayudaContrasena()}
        valor={contrasena}
        alCambiar={setContrasena}
        nativo={NATIVO_CONTRASENA}
      />
      <CampoTexto
        testID="respaldo-contrasena-confirmar"
        etiqueta={ETIQUETA_CONFIRMAR_CONTRASENA}
        valor={confirmacion}
        alCambiar={setConfirmacion}
        error={error}
        nativo={NATIVO_CONTRASENA}
        alEnviar={() => void guardar()}
      />
      <Boton
        testID="respaldo-contrasena-guardar"
        etiqueta={BTN_GUARDAR_CONTRASENA}
        cargando={guardando}
        deshabilitado={guardando || contrasena === '' || confirmacion === ''}
        alPresionar={() => void guardar()}
        pista={PISTA_GUARDAR_CONTRASENA}
      />
      <Boton
        testID="respaldo-contrasena-cancelar"
        variante="texto"
        etiqueta={BTN_CANCELAR}
        deshabilitado={guardando}
        alPresionar={alCancelar}
        pista={PISTA_CANCELAR_CONTRASENA}
      />
    </View>
  );
}
