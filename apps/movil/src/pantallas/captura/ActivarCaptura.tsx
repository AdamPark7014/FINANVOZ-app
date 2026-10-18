import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useCaptura } from '../../captura/ProveedorCaptura';
import type { AppBancaria } from '../../captura/tipos';
import {
  aceptarDivulgacionCaptura,
  activarCaptura,
  obtenerEstadoCaptura,
  registrarSenalesCaptura,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, EstadoVacio, Tarjeta, Texto } from '../../ui';
import { Casilla } from '../onboarding/componentes';
import {
  ALTERNATIVA_NO_DISPONIBLE,
  CUERPO_NO_DISPONIBLE,
  DIVULGACION_CAPTURA,
  ETIQUETA_NO_DISPONIBLE,
  INTRO_ELEGIR_APPS,
  LISTA_CAPTURA_ACTIVA,
  LISTA_CAPTURA_APPS,
  LISTA_CAPTURA_POR_REVISAR,
  PERMISO_AYUDA_ANDROID,
  PERMISO_DENEGADO,
  PERMISO_INSTRUCCION,
  etiquetaPermisoCaptura,
  etiquetaSinAppsBanco,
  TEXTO_SIN_APPS_BANCO,
  TITULO_ELEGIR_APPS,
  TITULO_PERMISO_NOTIFICACIONES,
} from './textos';

export { DIVULGACION_CAPTURA };

type Paso =
  | { tipo: 'no_disponible' }
  | { tipo: 'divulgacion' }
  | { tipo: 'permiso'; denegado: boolean }
  | { tipo: 'apps'; apps: readonly AppBancaria[] }
  | { tipo: 'lista'; nombres: readonly string[] };

/**
 * Activar la captura (O6, `02 §3`; Ajustes → Captura): divulgación destacada → "Activar" abre el ajuste del
 * sistema → al volver se revisa el permiso → elegir las apps de banco (ninguna viene marcada) → la lista blanca
 * se fija en el código nativo. Sin el módulo nativo solo dice que no está disponible.
 */
export function ActivarCaptura({
  testID,
  alTerminar,
}: {
  testID: string;
  /** "Continuar" / "Ahora no": la captura quedó activa o no. */
  alTerminar: (activada: boolean) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const { puente } = useCaptura();
  const [paso, setPaso] = useState<Paso>(() => {
    if (!puente) return { tipo: 'no_disponible' };
    const e = obtenerEstadoCaptura(ctx);
    return e.activada ? { tipo: 'lista', nombres: [] } : { tipo: 'divulgacion' };
  });
  const [marcadas, setMarcadas] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const revisarPermiso = useCallback(async () => {
    if (!puente) return;
    try {
      const permiso = await puente.estadoPermiso();
      registrarSenalesCaptura(ctx, { permiso });
      if (permiso !== 'concedido') {
        setPaso({ tipo: 'permiso', denegado: true });
        return;
      }
      const apps = await puente.appsBancariasInstaladas();
      registrarSenalesCaptura(ctx, { appsInstaladas: apps.map((a) => a.paquete) });
      setPaso({ tipo: 'apps', apps });
    } catch {
      setError('No pude revisar el acceso. Intenta de nuevo.');
    }
  }, [ctx, puente]);

  // Al volver del ajuste del sistema se revisa solo.
  useEffect(() => {
    if (paso.tipo !== 'permiso') return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisarPermiso();
    });
    return () => sub.remove();
  }, [paso.tipo, revisarPermiso]);

  const activar = async () => {
    if (!puente) return;
    setError(null);
    try {
      aceptarDivulgacionCaptura(ctx);
      if ((await puente.estadoPermiso()) === 'concedido') {
        await revisarPermiso();
        return;
      }
      setPaso({ tipo: 'permiso', denegado: false });
      await puente.abrirAjustesPermiso();
    } catch {
      setError('No pude abrir el ajuste. Intenta de nuevo.');
    }
  };

  const guardarApps = async (apps: readonly AppBancaria[]) => {
    if (!puente) return;
    setError(null);
    try {
      const quedaron = await puente.fijarListaBlanca(marcadas);
      activarCaptura(ctx, quedaron);
      refrescar();
      setPaso({
        tipo: 'lista',
        nombres: apps.filter((a) => quedaron.includes(a.paquete)).map((a) => a.nombre),
      });
    } catch {
      setError('No pude guardar las apps. Intenta de nuevo.');
    }
  };

  const continuar = (activada: boolean) => (
    <Boton etiqueta="Continuar" alPresionar={() => alTerminar(activada)} testID={`${testID}-continuar`} />
  );
  const ahoraNo = (
    <Boton
      etiqueta="Ahora no"
      variante="texto"
      alPresionar={() => alTerminar(false)}
      testID={`${testID}-ahora-no`}
    />
  );

  return (
    <View style={{ gap: espacio.m }}>
      {paso.tipo === 'no_disponible' ? (
        <>
          <Tarjeta testID={`${testID}-pronto`}>
            <Texto variante="etiqueta" tono="acento">
              {ETIQUETA_NO_DISPONIBLE}
            </Texto>
            <Texto variante="cuerpo">{CUERPO_NO_DISPONIBLE}</Texto>
          </Tarjeta>
          <Texto variante="cuerpo" tono="secundario">
            {ALTERNATIVA_NO_DISPONIBLE}
          </Texto>
          {continuar(false)}
        </>
      ) : null}

      {paso.tipo === 'divulgacion' ? (
        <>
          <Tarjeta testID={`${testID}-divulgacion`}>
            {DIVULGACION_CAPTURA.parrafos.map((p) => (
              <Texto key={p} variante="cuerpo">
                {p}
              </Texto>
            ))}
          </Tarjeta>
          <Boton etiqueta="Activar" alPresionar={() => void activar()} testID={`${testID}-activar`} />
          {ahoraNo}
        </>
      ) : null}

      {paso.tipo === 'permiso' ? (
        <>
          <Texto variante="subtitulo" accessibilityRole="header">
            {TITULO_PERMISO_NOTIFICACIONES}
          </Texto>
          <Tarjeta testID={paso.denegado ? `${testID}-permiso-denegado` : `${testID}-permiso`}>
            <Texto
              variante="cuerpo"
              testID={paso.denegado ? `${testID}-permiso-denegado-texto` : `${testID}-permiso-texto`}
              accessibilityLabel={etiquetaPermisoCaptura(paso.denegado)}
            >
              {paso.denegado ? PERMISO_DENEGADO : PERMISO_INSTRUCCION}
            </Texto>
            <Texto variante="secundario" tono="secundario">
              {PERMISO_AYUDA_ANDROID}
            </Texto>
          </Tarjeta>
          <View style={{ gap: espacio.s }}>
            <Boton etiqueta="Ya lo activé" alPresionar={() => void revisarPermiso()} testID={`${testID}-ya`} />
            <Boton
              etiqueta="Abrir el ajuste otra vez"
              variante="secundario"
              alPresionar={() => void puente?.abrirAjustesPermiso()}
              testID={`${testID}-abrir-ajuste`}
            />
            <Boton
              etiqueta="Abrir información de la app"
              variante="texto"
              alPresionar={() => void puente?.abrirInfoApp()}
              testID={`${testID}-info-app`}
            />
            {ahoraNo}
          </View>
        </>
      ) : null}

      {paso.tipo === 'apps' ? (
        paso.apps.length === 0 ? (
          <>
            <Texto variante="subtitulo" accessibilityRole="header">
              {TITULO_ELEGIR_APPS}
            </Texto>
            <EstadoVacio
              texto={TEXTO_SIN_APPS_BANCO}
              testID={`${testID}-sin-apps`}
              etiquetaAccesible={etiquetaSinAppsBanco()}
            />
            {continuar(false)}
          </>
        ) : (
          <>
            <Texto variante="subtitulo" accessibilityRole="header">
              {TITULO_ELEGIR_APPS}
            </Texto>
            <Texto variante="secundario" tono="secundario">
              {INTRO_ELEGIR_APPS}
            </Texto>
            {paso.apps.map((a) => (
              <Casilla
                key={a.paquete}
                etiqueta={a.nombre}
                valor={marcadas.includes(a.paquete)}
                alCambiar={(v) =>
                  setMarcadas((m) => (v ? [...m, a.paquete] : m.filter((p) => p !== a.paquete)))
                }
                testID={`${testID}-app-${a.banco}`}
              />
            ))}
            <View style={{ gap: espacio.s }}>
              <Boton
                etiqueta="Activar captura"
                deshabilitado={marcadas.length === 0}
                alPresionar={() => void guardarApps(paso.apps)}
                testID={`${testID}-guardar-apps`}
                etiquetaAccesible="Activar captura con las apps marcadas"
              />
              {ahoraNo}
            </View>
          </>
        )
      ) : null}

      {paso.tipo === 'lista' ? (
        <>
          <Tarjeta testID={`${testID}-lista`}>
            <Texto variante="cuerpo">
              {paso.nombres.length > 0 ? LISTA_CAPTURA_APPS(paso.nombres) : LISTA_CAPTURA_ACTIVA}
            </Texto>
            <Texto variante="secundario" tono="secundario">
              {LISTA_CAPTURA_POR_REVISAR}
            </Texto>
          </Tarjeta>
          {continuar(true)}
        </>
      ) : null}

      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </View>
  );
}
