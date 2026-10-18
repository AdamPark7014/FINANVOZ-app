import { useState } from 'react';
import {
  bajarUltimoRespaldo,
  obtenerCentroPrivacidad,
  prepararRestauracion,
  type RespaldoListo,
} from '../../servicios';
import { useControlApp } from '../../sesion/ControlApp';
import { useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, CampoTexto, Tarjeta, Texto } from '../../ui';
import { FlujoCorreo, type CuentaConfirmada } from './FlujoCorreo';
import {
  ACCESIBILIDAD_VOLVER_RESTAURAR,
  AVISO_REEMPLAZA_DATOS,
  BTN_ABRIR_RESPALDO,
  BTN_CANCELAR,
  BTN_DESDE_ARCHIVO,
  BTN_DESDE_NUBE,
  BTN_ELEGIR_ARCHIVO,
  BTN_ELEGIR_OTRO_ARCHIVO,
  BTN_RESTAURAR,
  BTN_VOLVER_A_ELEGIR,
  ETIQUETA_CONTRASENA,
  ETIQUETA_VOLVER,
  INTRO_RESTAURAR_ARCHIVO,
  INTRO_RESTAURAR_NUBE,
  PISTA_VOLVER_RESTAURAR,
  mensajeErrorNube,
  mensajeErrorRespaldo,
  RESTAURAR_NO_DISPONIBLE,
  resumenRespaldo,
  TEXTO_BAJANDO,
  TEXTO_CORREO_RESTAURAR,
  TEXTO_RESPALDO_RECIENTE,
  TITULO_RESTAURAR,
} from './textos';

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'nube' }
  | { tipo: 'contrasena'; archivo: Uint8Array; deLaNube: boolean }
  | { tipo: 'confirmar'; listo: RespaldoListo };

/**
 * Restaurar (M9, `02 §19`): desde la nube (correo → código → el respaldo más reciente) o desde un archivo
 * `.cartera`; después contraseña → resumen → restaurar.
 * Antes de tocar la base, el respaldo se descifra, se valida y se ensaya en memoria; contraseña equivocada y
 * archivo dañado dan el mismo mensaje, a propósito.
 */
export function Restaurar({ alVolver }: { alVolver: () => void }) {
  const respaldo = useControlApp().respaldo;
  const nube = respaldo?.nube ?? null;
  const { reidentificar } = usePlanTienda();
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
      if (archivo) setPaso({ tipo: 'contrasena', archivo, deLaNube: false });
    } catch (e) {
      setError(mensajeErrorRespaldo(e));
    } finally {
      setTrabajando(false);
    }
  };

  /** Ya entró con el correo: baja el respaldo más reciente de esa cuenta. */
  const bajar = async (r: CuentaConfirmada) => {
    if (!nube) return;
    // Las compras de Plus siguen al usuario de ese correo (pendiente 58).
    if (r.cambioUsuario) void reidentificar();
    setError(null);
    setTrabajando(true);
    try {
      const bajado = await bajarUltimoRespaldo(nube.respaldos);
      if (bajado.ok) setPaso({ tipo: 'contrasena', archivo: bajado.bytes, deLaNube: true });
      else setError(mensajeErrorNube(bajado.error));
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
        etiqueta={ETIQUETA_VOLVER}
        etiquetaAccesible={ACCESIBILIDAD_VOLVER_RESTAURAR}
        pista={PISTA_VOLVER_RESTAURAR}
        deshabilitado={trabajando}
        alPresionar={alVolver}
      />
      <Texto variante="titulo">{TITULO_RESTAURAR}</Texto>
      <Texto variante="cuerpo" tono="secundario">
        {nube ? INTRO_RESTAURAR_NUBE : INTRO_RESTAURAR_ARCHIVO}
      </Texto>
      {!respaldo ? (
        <Texto variante="cuerpo">{RESTAURAR_NO_DISPONIBLE}</Texto>
      ) : (
        <Tarjeta testID="restaurar-paso">
          {paso.tipo === 'elegir' ? (
            <>
              {nube ? (
                <Boton
                  testID="restaurar-nube"
                  etiqueta={BTN_DESDE_NUBE}
                  deshabilitado={trabajando}
                  alPresionar={() => {
                    setError(null);
                    setPaso({ tipo: 'nube' });
                  }}
                />
              ) : null}
              <Boton
                testID="restaurar-elegir"
                variante={nube ? 'secundario' : 'primario'}
                etiqueta={nube ? BTN_DESDE_ARCHIVO : BTN_ELEGIR_ARCHIVO}
                cargando={trabajando}
                deshabilitado={trabajando}
                alPresionar={() => void elegir()}
              />
            </>
          ) : paso.tipo === 'nube' ? (
            <>
              <Texto variante="secundario" tono="secundario">
                {TEXTO_CORREO_RESTAURAR}
              </Texto>
              {trabajando ? (
                <Texto variante="cuerpo" tono="secundario" testID="restaurar-bajando">
                  {TEXTO_BAJANDO}
                </Texto>
              ) : nube ? (
                <FlujoCorreo cuenta={nube.cuenta} soloEntrar alConfirmar={(r) => void bajar(r)} />
              ) : null}
              <Boton
                variante="texto"
                etiqueta={BTN_VOLVER_A_ELEGIR}
                deshabilitado={trabajando}
                alPresionar={() => {
                  setError(null);
                  setPaso({ tipo: 'elegir' });
                }}
              />
            </>
          ) : paso.tipo === 'contrasena' ? (
            <>
              {paso.deLaNube ? (
                <Texto variante="cuerpo" testID="restaurar-encontre">
                  {TEXTO_RESPALDO_RECIENTE}
                </Texto>
              ) : null}
              <CampoTexto
                testID="restaurar-contrasena"
                etiqueta={ETIQUETA_CONTRASENA}
                valor={contrasena}
                alCambiar={setContrasena}
                autoFocus
                nativo={{ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false }}
                alEnviar={() => void abrir(paso.archivo)}
              />
              <Boton
                testID="restaurar-abrir"
                etiqueta={BTN_ABRIR_RESPALDO}
                cargando={trabajando}
                deshabilitado={trabajando || contrasena === ''}
                alPresionar={() => void abrir(paso.archivo)}
              />
              <Boton
                variante="texto"
                etiqueta={paso.deLaNube ? BTN_VOLVER_A_ELEGIR : BTN_ELEGIR_OTRO_ARCHIVO}
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
                  {AVISO_REEMPLAZA_DATOS}
                </Texto>
              ) : null}
              <Boton
                testID="restaurar-confirmar"
                etiqueta={BTN_RESTAURAR}
                cargando={trabajando}
                deshabilitado={trabajando}
                alPresionar={() => void restaurar(paso.listo)}
              />
              <Boton
                variante="texto"
                etiqueta={BTN_CANCELAR}
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
