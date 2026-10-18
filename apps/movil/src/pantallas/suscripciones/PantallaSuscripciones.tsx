import { useState } from 'react';
import { View } from 'react-native';
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
import { Boton, CampoTexto, espacio, EstadoVacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { mensajeError } from '../principal/textos';
import {
  AYUDA_NOMBRE,
  ETIQUETA_CANCELADA,
  ETIQUETA_COMPROMISO,
  ETIQUETA_EDITAR_NOMBRE,
  ETIQUETA_GUARDAR_NOMBRE,
  ETIQUETA_NOMBRE,
  ETIQUETA_NO_ES,
  ETIQUETA_VOLVER,
  etiquetaAccesibleAyudaSuscripciones,
  etiquetaAccesibleResumenSuscripciones,
  etiquetaInactivasSuscripciones,
  etiquetaVacioSuscripciones,
  mensajeAccionSuscripcion,
  mensajeNombreGuardado,
  PISTA_AYUDA,
  PISTA_CANCELADA,
  PISTA_COMPROMISO,
  PISTA_EDITAR_NOMBRE,
  PISTA_GUARDAR_NOMBRE,
  PISTA_NO_ES,
  PISTA_VOLVER,
  TEXTO_HOY_APARTA,
  TEXTO_SUSCRIPCIONES_VACIO,
  TITULO_PANTALLA,
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
export function PantallaSuscripciones({ alVolver }: { alVolver: () => void }) {
  const { ctx, refrescar } = useSesion();
  const v = useVista(listarSuscripciones);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
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
    <Pantalla testID="pantalla-suscripciones" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="suscripciones-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista={PISTA_VOLVER}
      />
      <Texto testID="suscripciones-titulo" variante="titulo" accessibilityRole="header">
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
          testID="suscripciones-mensaje"
        >
          {mensaje.texto}
        </Texto>
      ) : null}
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
      {v.textoInactivas ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID="suscripciones-inactivas"
          accessibilityLabel={etiquetaInactivasSuscripciones(v.textoInactivas)}
        >
          {v.textoInactivas}
        </Texto>
      ) : null}
    </Pantalla>
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
    <Tarjeta testID={id}>
      <View style={{ gap: espacio.xxs }}>
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
        <Texto variante="cuerpo" testID={`${id}-monto`}>
          {s.textoAntes ? `${s.textoMonto} (${s.textoAntes})` : s.textoMonto}
        </Texto>
        {s.textoProximo ? (
          <Texto variante="secundario" tono="secundario" testID={`${id}-proximo`}>
            {s.textoProximo}
          </Texto>
        ) : null}
      </View>
      {s.compromiso ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="acento" testID={`${id}-apartada`}>
            {TEXTO_HOY_APARTA}
          </Texto>
          <Boton
            testID={`${id}-cancelada`}
            etiqueta={ETIQUETA_CANCELADA}
            variante="texto"
            ancho="contenido"
            alPresionar={() => alHacer('cancelada')}
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
            alPresionar={() => alHacer('cancelada')}
            pista={PISTA_CANCELADA}
          />
          <Boton
            testID={`${id}-no-es`}
            etiqueta={ETIQUETA_NO_ES}
            variante="texto"
            ancho="contenido"
            alPresionar={() => alHacer('no_es')}
            pista={PISTA_NO_ES}
          />
        </View>
      )}
    </Tarjeta>
  );
}
