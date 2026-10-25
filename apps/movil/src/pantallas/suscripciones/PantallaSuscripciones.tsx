import { useState } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import {
  convertirEnCompromiso,
  fijarNombreSuscripcion,
  listarSuscripciones,
  marcarNoEsSuscripcion,
  yaLaCancele,
  type Contexto,
  type SuscripcionVista,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Boton,
  CampoTexto,
  espacio,
  EstadoVacio,
  OBJETIVO_TACTIL_MIN,
  Pantalla,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { useAnunciarEnIos } from '../avisos/anunciar';
import { mensajeError } from '../principal/textos';
import {
  AYUDA_NOMBRE,
  BTN_NO_DEJALA,
  BTN_SI_CANCELADA,
  BTN_SI_NO_ES,
  ETIQUETA_CANCELADA,
  ETIQUETA_COMPROMISO,
  ETIQUETA_EDITAR_NOMBRE,
  ETIQUETA_GUARDAR_NOMBRE,
  ETIQUETA_NOMBRE,
  ETIQUETA_NO_ES,
  ETIQUETA_VOLVER,
  etiquetaAccesibleAyudaSuscripciones,
  etiquetaAccesibleHoyApartaSuscripcion,
  etiquetaAccesibleInactivasBoton,
  etiquetaAccesibleInactivasDetalle,
  etiquetaAccesibleMontoSuscripcion,
  etiquetaAccesibleProximoSuscripcion,
  etiquetaAccesibleResumenSuscripciones,
  etiquetaVacioSuscripciones,
  TITULO_PANTALLA,
  ICONO_INACTIVAS_ABIERTA,
  ICONO_INACTIVAS_CERRADA,
  pistaInactivasSuscripciones,
  TITULO_INACTIVAS,
  mensajeAccionSuscripcion,
  mensajeNombreGuardado,
  PISTA_AYUDA,
  PISTA_CANCELADA,
  PISTA_COMPROMISO,
  PISTA_EDITAR_NOMBRE,
  PISTA_GUARDAR_NOMBRE,
  PISTA_NO_DEJALA,
  PISTA_NO_ES,
  PISTA_VOLVER,
  TEXTO_HOY_APARTA,
  TEXTO_SUSCRIPCIONES_VACIO,
  textoConfirmarCancelada,
  textoConfirmarNoEs,
  type AccionSuscripcion,
} from './textos';

const HACER: Record<AccionSuscripcion, (ctx: Contexto, comercio: string) => unknown> = {
  compromiso: convertirEnCompromiso,
  cancelada: yaLaCancele,
  no_es: marcarNoEsSuscripcion,
};

/**
 * Cuentas → Suscripciones (`02 §20`, RF-INT-01, Gratis): las activas con su monto y próximo cargo, "Pagas unos
 * $X al mes", el aumento de precio ("antes $115") y las que ya no se cobran. Por fila: Convertir en compromiso
 * (Hoy la aparta), Ya la cancelé y No es suscripción.
 */
export function PantallaSuscripciones({ alVolver }: { alVolver?: () => void }) {
  const { ctx, refrescar } = useSesion();
  const v = useVista(listarSuscripciones);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  useAnunciarEnIos(mensaje?.texto);
  const hacer = (accion: AccionSuscripcion, s: SuscripcionVista) => {
    try {
      HACER[accion](ctx, s.comercio);
      setMensaje({ texto: mensajeAccionSuscripcion(accion, s.nombre), error: false });
    } catch (e) {
      setMensaje({ texto: mensajeError(e), error: true });
    }
    refrescar();
  };
  return (
    <Pantalla
      testID="pantalla-suscripciones"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      {alVolver ? (
        <Boton
          testID="suscripciones-volver"
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          alPresionar={alVolver}
          pista={PISTA_VOLVER}
        />
      ) : null}
      <Texto
        testID="suscripciones-titulo"
        variante="titulo"
        accessibilityRole="header"
        accessibilityLabel={TITULO_PANTALLA}
      >
        {TITULO_PANTALLA}
      </Texto>
      {v.activas.length > 0 ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID="suscripciones-ayuda"
          accessibilityLabel={etiquetaAccesibleAyudaSuscripciones()}
        >
          {PISTA_AYUDA}
        </Texto>
      ) : null}
      {v.textoResumen ? (
        <Texto
          variante="cuerpoFuerte"
          testID="suscripciones-resumen"
          accessibilityLabel={etiquetaAccesibleResumenSuscripciones(v.textoResumen)}
        >
          {v.textoResumen}
        </Texto>
      ) : (
        <EstadoVacio
          texto={TEXTO_SUSCRIPCIONES_VACIO}
          testID="suscripciones-vacio"
          etiquetaAccesible={etiquetaVacioSuscripciones()}
        />
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono={mensaje.error ? 'faltante' : 'secundario'}
          accessibilityRole={mensaje.error ? 'alert' : 'text'}
          accessibilityLiveRegion="polite"
          importantForAccessibility="yes"
          accessibilityLabel={mensaje.texto}
          testID="suscripciones-mensaje"
        >
          {mensaje.texto}
        </Texto>
      ) : null}
      <View
        style={{ gap: espacio.s }}
        testID="suscripciones-activas"
        {...({ accessibilityRole: 'list' } as ViewProps)}
      >
        {v.activas.map((s) => (
          <Fila
            key={`${s.comercio}-${s.nombre}`}
            s={s}
            alHacer={(a) => hacer(a, s)}
            alRenombrar={(nombre) => {
              try {
                fijarNombreSuscripcion(ctx, s.comercio, nombre);
                setMensaje({ texto: mensajeNombreGuardado(nombre), error: false });
              } catch (e) {
                setMensaje({ texto: mensajeError(e), error: true });
              }
              refrescar();
            }}
          />
        ))}
      </View>
      {v.textoInactivas ? (
        <SeccionInactivas textoInactivas={v.textoInactivas} cantidad={v.inactivas.length} />
      ) : null}
    </Pantalla>
  );
}

function SeccionInactivas({ textoInactivas, cantidad }: { textoInactivas: string; cantidad: number }) {
  const { c } = useTema();
  const [abierta, setAbierta] = useState(true);
  const tituloVisible = cantidad === 1 ? TITULO_INACTIVAS : `${TITULO_INACTIVAS} (${cantidad})`;
  return (
    <Tarjeta testID="suscripciones-inactivas-seccion">
      <Pressable
        testID="suscripciones-inactivas-desplegar"
        onPress={() => setAbierta((a) => !a)}
        accessibilityRole="button"
        accessibilityLabel={etiquetaAccesibleInactivasBoton(cantidad, textoInactivas, abierta)}
        accessibilityHint={pistaInactivasSuscripciones(abierta)}
        accessibilityState={{ expanded: abierta }}
        style={({ pressed }) => ({
          minHeight: OBJETIVO_TACTIL_MIN,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.s,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Texto variante="cuerpoFuerte" importantForAccessibility="no">
            {tituloVisible}
          </Texto>
        </View>
        <Texto
          variante="cuerpoFuerte"
          style={{ color: c.acentoTexto }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {abierta ? ICONO_INACTIVAS_ABIERTA : ICONO_INACTIVAS_CERRADA}
        </Texto>
      </Pressable>
      {abierta ? (
        <View accessibilityLiveRegion="polite" importantForAccessibility="yes">
          <Texto
            variante="secundario"
            tono="secundario"
            testID="suscripciones-inactivas"
            accessibilityLabel={etiquetaAccesibleInactivasDetalle(textoInactivas)}
          >
            {textoInactivas}
          </Texto>
        </View>
      ) : null}
    </Tarjeta>
  );
}

function Fila({
  s,
  alHacer,
  alRenombrar,
}: {
  s: SuscripcionVista;
  alHacer: (a: AccionSuscripcion) => void;
  alRenombrar: (nombre: string) => void;
}) {
  const id = `suscripcion-${s.comercio.replace(/ /g, '-').toLowerCase()}`;
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState(s.nombre);
  // "Ya la cancelé" y "No es suscripción" la quitan sin Deshacer: primero se pregunta en la misma fila.
  const [confirmando, setConfirmando] = useState<'cancelada' | 'no_es' | null>(null);
  const textoConfirmacion =
    confirmando === 'cancelada'
      ? textoConfirmarCancelada(s.nombre, s.compromiso)
      : confirmando === 'no_es'
        ? textoConfirmarNoEs(s.nombre)
        : null;
  useAnunciarEnIos(textoConfirmacion);
  const preguntar = (accion: 'cancelada' | 'no_es') => setConfirmando(accion);
  const guardarNombre = () => {
    const t = nombre.trim();
    if (!t || t === s.nombre) {
      setEditandoNombre(false);
      setNombre(s.nombre);
      return;
    }
    alRenombrar(t);
    setEditandoNombre(false);
  };
  return (
    <View testID={id} role="listitem">
      <Tarjeta>
        <View style={{ gap: espacio.xs }}>
          {editandoNombre ? (
            <CampoTexto
              etiqueta={ETIQUETA_NOMBRE}
              valor={nombre}
              alCambiar={setNombre}
              testID={`${id}-nombre`}
              alEnviar={guardarNombre}
              ayuda={AYUDA_NOMBRE}
            />
          ) : (
            <Texto variante="cuerpoFuerte" testID={`${id}-nombre`} accessibilityRole="header">
              {s.nombre}
            </Texto>
          )}
          {!editandoNombre ? (
            <Boton
              testID={`${id}-editar-nombre`}
              etiqueta={ETIQUETA_EDITAR_NOMBRE}
              variante="texto"
              ancho="contenido"
              alPresionar={() => setEditandoNombre(true)}
              pista={PISTA_EDITAR_NOMBRE}
            />
          ) : (
            <Boton
              testID={`${id}-guardar-nombre`}
              etiqueta={ETIQUETA_GUARDAR_NOMBRE}
              variante="secundario"
              alPresionar={guardarNombre}
              pista={PISTA_GUARDAR_NOMBRE}
            />
          )}
          <Texto
            variante="cuerpo"
            testID={`${id}-monto`}
            accessibilityLabel={etiquetaAccesibleMontoSuscripcion(s.textoMonto, s.textoAntes)}
          >
            {s.textoAntes ? `${s.textoMonto} (${s.textoAntes})` : s.textoMonto}
          </Texto>
          {s.textoProximo ? (
            <Texto
              variante="secundario"
              tono="secundario"
              testID={`${id}-proximo`}
              accessibilityLabel={etiquetaAccesibleProximoSuscripcion(s.textoProximo)}
            >
              {s.textoProximo}
            </Texto>
          ) : null}
        </View>
        {confirmando ? (
          <View style={{ gap: espacio.xs }} testID={`${id}-confirmacion`}>
            <Texto variante="cuerpo" testID={`${id}-confirmacion-texto`} accessibilityLiveRegion="polite">
              {textoConfirmacion}
            </Texto>
            <Boton
              testID={`${id}-confirmar`}
              etiqueta={confirmando === 'cancelada' ? BTN_SI_CANCELADA : BTN_SI_NO_ES}
              variante="secundario"
              alPresionar={() => {
                setConfirmando(null);
                alHacer(confirmando);
              }}
              pista={confirmando === 'cancelada' ? PISTA_CANCELADA : PISTA_NO_ES}
            />
            <Boton
              testID={`${id}-no-confirmar`}
              etiqueta={BTN_NO_DEJALA}
              variante="texto"
              ancho="contenido"
              alPresionar={() => setConfirmando(null)}
              pista={PISTA_NO_DEJALA}
            />
          </View>
        ) : s.compromiso ? (
          <View style={{ gap: espacio.xs }}>
            <Texto
              variante="secundario"
              tono="acento"
              testID={`${id}-apartada`}
              accessibilityLabel={etiquetaAccesibleHoyApartaSuscripcion(s.nombre)}
            >
              {TEXTO_HOY_APARTA}
            </Texto>
            <Boton
              testID={`${id}-cancelada`}
              etiqueta={ETIQUETA_CANCELADA}
              variante="texto"
              ancho="contenido"
              alPresionar={() => preguntar('cancelada')}
              pista={PISTA_CANCELADA}
            />
          </View>
        ) : (
          <View style={{ gap: espacio.xs }}>
            <Boton
              testID={`${id}-compromiso`}
              etiqueta={ETIQUETA_COMPROMISO}
              variante="secundario"
              alPresionar={() => alHacer('compromiso')}
              pista={PISTA_COMPROMISO}
            />
            <Boton
              testID={`${id}-cancelada`}
              etiqueta={ETIQUETA_CANCELADA}
              variante="texto"
              ancho="contenido"
              alPresionar={() => preguntar('cancelada')}
              pista={PISTA_CANCELADA}
            />
            <Boton
              testID={`${id}-no-es`}
              etiqueta={ETIQUETA_NO_ES}
              variante="texto"
              ancho="contenido"
              alPresionar={() => preguntar('no_es')}
              pista={PISTA_NO_ES}
            />
          </View>
        )}
      </Tarjeta>
    </View>
  );
}
