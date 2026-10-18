import { useState } from 'react';
import {
  confirmarCodigoRespaldo,
  mensajeErrorNube,
  type CuentaRespaldo,
  type ModoCodigo,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, Texto } from '../../ui';
import {
  BTN_CONFIRMAR,
  BTN_ENVIAR_CODIGO,
  BTN_USAR_OTRO_CORREO,
  ETIQUETA_CODIGO,
  ETIQUETA_CORREO,
  PISTA_CONFIRMAR_CODIGO,
  PISTA_ENVIAR_CODIGO,
  PISTA_USAR_OTRO_CORREO,
  textoCodigoEnviado,
} from './textos';

export interface CuentaConfirmada {
  readonly modo: ModoCodigo;
  /** El usuario del proxy cambió (entrar a otra cuenta): las compras deben seguirlo (pendiente 58). */
  readonly cambioUsuario: boolean;
}

/**
 * Correo → código de 6 dígitos (`02 §19`). Vincula el correo a la cuenta anónima de este teléfono o, si ese
 * correo ya tiene cuenta (otro teléfono), entra a ella. Con `soloEntrar` (restaurar) va directo a entrar. El
 * correo y el código nunca se registran (regla 9).
 */
export function FlujoCorreo({
  cuenta,
  soloEntrar = false,
  alConfirmar,
}: {
  cuenta: CuentaRespaldo;
  soloEntrar?: boolean;
  alConfirmar: (r: CuentaConfirmada) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [modo, setModo] = useState<ModoCodigo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const pedir = async () => {
    setError(null);
    setTrabajando(true);
    try {
      const r = await cuenta.pedirCodigo(correo, { soloEntrar });
      if (r.ok) {
        setCodigo('');
        setModo(r.modo);
      } else setError(mensajeErrorNube(r.error));
    } finally {
      setTrabajando(false);
    }
  };

  const confirmar = async (m: ModoCodigo) => {
    setError(null);
    setTrabajando(true);
    try {
      const r = await confirmarCodigoRespaldo(cuenta, ctx, correo, codigo, m);
      if (!r.ok) {
        setError(mensajeErrorNube(r.error));
        return;
      }
      refrescar();
      alConfirmar({ modo: m, cambioUsuario: r.cambioUsuario });
    } finally {
      setTrabajando(false);
    }
  };

  return modo === null ? (
    <>
      <CampoTexto
        testID="respaldo-correo"
        etiqueta={ETIQUETA_CORREO}
        valor={correo}
        alCambiar={setCorreo}
        teclado="email-address"
        nativo={{ autoCapitalize: 'none', autoCorrect: false, autoComplete: 'email' }}
        alEnviar={() => void pedir()}
      />
      <Boton
        testID="respaldo-pedir-codigo"
        etiqueta={BTN_ENVIAR_CODIGO}
        cargando={trabajando}
        deshabilitado={trabajando || correo.trim() === ''}
        pista={PISTA_ENVIAR_CODIGO}
        alPresionar={() => void pedir()}
      />
      {error ? <MensajeError texto={error} /> : null}
    </>
  ) : (
    <>
      <Texto variante="secundario" tono="secundario" testID="respaldo-codigo-enviado">
        {textoCodigoEnviado(correo)}
      </Texto>
      <CampoTexto
        testID="respaldo-codigo"
        etiqueta={ETIQUETA_CODIGO}
        valor={codigo}
        alCambiar={setCodigo}
        teclado="number-pad"
        autoFocus
        nativo={{ autoComplete: 'one-time-code', textContentType: 'oneTimeCode' }}
        alEnviar={() => void confirmar(modo)}
      />
      <Boton
        testID="respaldo-confirmar-codigo"
        etiqueta={BTN_CONFIRMAR}
        cargando={trabajando}
        deshabilitado={trabajando || codigo.trim() === ''}
        pista={PISTA_CONFIRMAR_CODIGO}
        alPresionar={() => void confirmar(modo)}
      />
      <Boton
        variante="texto"
        ancho="contenido"
        etiqueta={BTN_USAR_OTRO_CORREO}
        deshabilitado={trabajando}
        pista={PISTA_USAR_OTRO_CORREO}
        alPresionar={() => {
          setError(null);
          setModo(null);
        }}
      />
      {error ? <MensajeError texto={error} /> : null}
    </>
  );
}

function MensajeError({ texto }: { texto: string }) {
  return (
    <Texto
      variante="secundario"
      tono="faltante"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID="respaldo-nube-error"
    >
      {texto}
    </Texto>
  );
}
