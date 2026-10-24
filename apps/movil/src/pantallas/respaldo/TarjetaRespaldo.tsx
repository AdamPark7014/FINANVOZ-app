import { useState } from 'react';
import {
  generarRespaldo,
  nombreArchivoRespaldo,
  registrarRespaldoArchivo,
  tieneContrasenaRespaldo,
} from '../../servicios';
import { useControlApp } from '../../sesion/ControlApp';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Tarjeta, Texto } from '../../ui';
import { anunciar } from '../../ui/anunciar';
import { FormularioContrasena } from './FormularioContrasena';
import {
  BTN_CAMBIAR_CONTRASENA,
  BTN_CREAR_CONTRASENA,
  BTN_EXPORTAR_ARCHIVO,
  BTN_RESTAURAR_RESPALDO,
  DESCRIPCION_ARCHIVO,
  MENSAJE_ARCHIVO_COMPARTIDO,
  MENSAJE_CONTRASENA_GUARDADA,
  MENSAJE_NO_EXPORTAR,
  PISTA_CAMBIAR_CONTRASENA,
  PISTA_CREAR_CONTRASENA,
  PISTA_EXPORTAR_ARCHIVO,
  PISTA_RESTAURAR_RESPALDO,
  SUBTITULO_ARCHIVO,
} from './textos';

/**
 * Respaldo cifrado en el centro de privacidad (M9, `02 §19`): crear o cambiar la contraseña, exportar el
 * `.cartera` por la hoja de compartir y restaurar uno. El archivo va cifrado; la contraseña no se guarda.
 */
export function TarjetaRespaldo({
  alRestaurar,
  alCambiarContrasena,
}: {
  alRestaurar: () => void;
  /** Ajustes → Respaldo: avisa a la tarjeta de la nube que ya hay contraseña. */
  alCambiarContrasena?: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const respaldo = useControlApp().respaldo;
  const [conContrasena, setConContrasena] = useState(() => {
    try {
      return respaldo ? tieneContrasenaRespaldo(respaldo.deps) : false;
    } catch {
      // Una llave guardada ilegible: se ofrece crear la contraseña otra vez (la nueva la reemplaza).
      return false;
    }
  });
  const [editando, setEditando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensajeBase] = useState<string | null>(null);
  // VoiceOver no lee la región viva del mensaje: en iPhone se anuncia aparte.
  const setMensaje = (texto: string | null) => {
    setMensajeBase(texto);
    if (texto) anunciar(texto);
  };

  if (!respaldo) return null;

  const exportar = async () => {
    setExportando(true);
    setMensaje(null);
    try {
      const archivo = await generarRespaldo(respaldo.deps, ctx);
      await respaldo.archivos.compartir(nombreArchivoRespaldo(ctx), archivo);
      // La hoja ya se cerró: la fecha cuenta como respaldo para la tarjeta de Ajustes y el aviso de 14 días.
      registrarRespaldoArchivo(ctx);
      refrescar();
      setMensaje(MENSAJE_ARCHIVO_COMPARTIDO);
    } catch {
      setMensaje(MENSAJE_NO_EXPORTAR);
    } finally {
      setExportando(false);
    }
  };

  return (
    <Tarjeta testID="privacidad-respaldo" style={{ gap: espacio.m }}>
      <Texto variante="subtitulo" testID="privacidad-respaldo-titulo" accessibilityRole="header">
        {SUBTITULO_ARCHIVO}
      </Texto>
      <Texto variante="secundario" tono="secundario">
        {DESCRIPCION_ARCHIVO}
      </Texto>
      {editando ? (
        <FormularioContrasena
          deps={respaldo.deps}
          cambiando={conContrasena}
          alGuardar={() => {
            setConContrasena(true);
            setEditando(false);
            alCambiarContrasena?.();
            setMensaje(MENSAJE_CONTRASENA_GUARDADA);
          }}
          alCancelar={() => setEditando(false)}
        />
      ) : conContrasena ? (
        <>
          <Boton
            testID="privacidad-respaldo-exportar"
            variante="secundario"
            etiqueta={BTN_EXPORTAR_ARCHIVO}
            cargando={exportando}
            deshabilitado={exportando}
            alPresionar={() => void exportar()}
            pista={PISTA_EXPORTAR_ARCHIVO}
          />
          <Boton
            testID="privacidad-respaldo-cambiar"
            variante="texto"
            ancho="contenido"
            etiqueta={BTN_CAMBIAR_CONTRASENA}
            pista={PISTA_CAMBIAR_CONTRASENA}
            alPresionar={() => {
              setMensaje(null);
              setEditando(true);
            }}
          />
        </>
      ) : (
        <Boton
          testID="privacidad-respaldo-crear"
          variante="secundario"
          etiqueta={BTN_CREAR_CONTRASENA}
          pista={PISTA_CREAR_CONTRASENA}
          alPresionar={() => {
            setMensaje(null);
            setEditando(true);
          }}
        />
      )}
      {editando ? null : (
        <Boton
          testID="privacidad-respaldo-restaurar"
          variante="texto"
          ancho="contenido"
          etiqueta={BTN_RESTAURAR_RESPALDO}
          pista={PISTA_RESTAURAR_RESPALDO}
          alPresionar={alRestaurar}
        />
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID="privacidad-respaldo-mensaje"
        >
          {mensaje}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
