import { useState } from 'react';
import {
  mensajeErrorRespaldo,
  obtenerCentroPrivacidad,
  prepararRestauracion,
  resumenRespaldo,
  type RespaldoListo,
} from '../../servicios';
import { useControlApp } from '../../sesion/ControlApp';
import { useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, Tarjeta, Texto } from '../../ui';

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'contrasena'; archivo: Uint8Array }
  | { tipo: 'confirmar'; listo: RespaldoListo };

/**
 * Restaurar desde un archivo `.cartera` (M9, `02 §19`): elegir el archivo → contraseña → resumen → restaurar.
 * Antes de tocar la base, el respaldo se descifra, se valida y se ensaya en memoria; contraseña equivocada y
 * archivo dañado dan el mismo mensaje, a propósito.
 */
export function Restaurar({ alVolver }: { alVolver: () => void }) {
  const respaldo = useControlApp().respaldo;
  const tieneDatos = useVista((ctx) => {
    const g = obtenerCentroPrivacidad(ctx).guardado;
    return g.cuentas + g.movimientos > 0;
  });
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' });
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const elegir = async () => {
    if (!respaldo) return;
    setError(null);
    setTrabajando(true);
    try {
      const archivo = await respaldo.archivos.elegir();
      if (archivo) setPaso({ tipo: 'contrasena', archivo });
    } catch (e) {
      setError(mensajeErrorRespaldo(e));
    } finally {
      setTrabajando(false);
    }
  };

  const abrir = async (archivo: Uint8Array) => {
    if (!respaldo) return;
    setError(null);
    setTrabajando(true);
    try {
      const listo = await prepararRestauracion(respaldo.deps, archivo, contrasena);
      setContrasena('');
      setPaso({ tipo: 'confirmar', listo });
    } catch (e) {
      setError(mensajeErrorRespaldo(e));
    } finally {
      setTrabajando(false);
    }
  };

  const restaurar = async (listo: RespaldoListo) => {
    if (!respaldo) return;
    setTrabajando(true);
    // La raíz reemplaza la sesión y vuelve al inicio con "Listo: recuperé…".
    await respaldo.restaurar(listo);
  };

  return (
    <>
      <Boton
        testID="restaurar-volver"
        variante="texto"
        ancho="contenido"
        etiqueta="Volver"
        deshabilitado={trabajando}
        alPresionar={alVolver}
      />
      <Texto variante="titulo">Restaurar un respaldo</Texto>
      <Texto variante="cuerpo" tono="secundario">
        Recupera tus cuentas, movimientos y ajustes desde un archivo .cartera que exportaste antes.
      </Texto>
      {!respaldo ? (
        <Texto variante="cuerpo">Restaurar no está disponible en esta versión de la app.</Texto>
      ) : (
        <Tarjeta testID="restaurar-paso">
          {paso.tipo === 'elegir' ? (
            <Boton
              testID="restaurar-elegir"
              etiqueta="Elegir archivo"
              cargando={trabajando}
              deshabilitado={trabajando}
              alPresionar={() => void elegir()}
            />
          ) : paso.tipo === 'contrasena' ? (
            <>
              <CampoTexto
                testID="restaurar-contrasena"
                etiqueta="Contraseña del respaldo"
                valor={contrasena}
                alCambiar={setContrasena}
                autoFocus
                nativo={{ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false }}
                alEnviar={() => void abrir(paso.archivo)}
              />
              <Boton
                testID="restaurar-abrir"
                etiqueta="Abrir respaldo"
                cargando={trabajando}
                deshabilitado={trabajando || contrasena === ''}
                alPresionar={() => void abrir(paso.archivo)}
              />
              <Boton
                variante="texto"
                etiqueta="Elegir otro archivo"
                deshabilitado={trabajando}
                alPresionar={() => {
                  setError(null);
                  setContrasena('');
                  setPaso({ tipo: 'elegir' });
                }}
              />
            </>
          ) : (
            <>
              <Texto variante="cuerpo" testID="restaurar-resumen">
                {resumenRespaldo(paso.listo)}
              </Texto>
              {tieneDatos ? (
                <Texto variante="cuerpo" tono="faltante" testID="restaurar-reemplaza">
                  Se reemplaza todo lo que hay ahora en este teléfono. Si quieres conservarlo, primero exporta
                  un respaldo.
                </Texto>
              ) : null}
              <Boton
                testID="restaurar-confirmar"
                etiqueta="Restaurar"
                cargando={trabajando}
                deshabilitado={trabajando}
                alPresionar={() => void restaurar(paso.listo)}
              />
              <Boton
                variante="texto"
                etiqueta="Cancelar"
                deshabilitado={trabajando}
                alPresionar={() => setPaso({ tipo: 'elegir' })}
              />
            </>
          )}
          {error ? (
            <Texto
              variante="secundario"
              tono="faltante"
              accessibilityLiveRegion="polite"
              testID="restaurar-error"
            >
              {error}
            </Texto>
          ) : null}
        </Tarjeta>
      )}
    </>
  );
}
