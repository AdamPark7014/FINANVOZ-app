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
import { Boton, CampoTexto, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { mensajeError } from '../principal/textos';

type Accion = 'compromiso' | 'cancelada' | 'no_es';

const MENSAJE: Record<Accion, (nombre: string) => string> = {
  compromiso: (n) => `Listo: Hoy aparta tu ${n} antes de cada cargo.`,
  cancelada: (n) => `Ya no te muestro ${n}. Si vuelve a cobrarse, te aviso aquí.`,
  no_es: (n) => `Listo: ${n} ya no aparece como suscripción.`,
};

const HACER: Record<Accion, (ctx: Contexto, comercio: string) => unknown> = {
  compromiso: convertirEnCompromiso,
  cancelada: yaLaCancele,
  no_es: marcarNoEsSuscripcion,
};

const PISTA_AYUDA =
  'Aprétala en Hoy, dilo si ya no la pagas o si no es suscripción.';

/**
 * Cuentas → Suscripciones (`02 §20`, RF-INT-01, Gratis): las activas con su monto y próximo cargo, "Pagas unos
 * $X al mes", el aumento de precio ("antes $115") y las que ya no se cobran. Por fila: Convertir en compromiso
 * (Hoy la aparta), Ya la cancelé y No es suscripción.
 */
export function PantallaSuscripciones({ alVolver }: { alVolver: () => void }) {
  const { ctx, refrescar } = useSesion();
  const v = useVista(listarSuscripciones);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const hacer = (accion: Accion, s: SuscripcionVista) => {
    try {
      HACER[accion](ctx, s.comercio);
      setMensaje({ texto: MENSAJE[accion](s.nombre), error: false });
    } catch (e) {
      setMensaje({ texto: mensajeError(e), error: true });
    }
    refrescar();
  };
  return (
    <Pantalla testID="pantalla-suscripciones" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="suscripciones-volver"
        etiqueta="Volver"
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista="Regresa a Cuentas"
      />
      <Texto variante="titulo">Suscripciones</Texto>
      {v.activas.length > 0 ? (
        <Texto variante="secundario" tono="secundario" testID="suscripciones-ayuda">
          {PISTA_AYUDA}
        </Texto>
      ) : null}
      {v.textoResumen ? (
        <Texto variante="cuerpoFuerte" testID="suscripciones-resumen">
          {v.textoResumen}
        </Texto>
      ) : (
        <Texto variante="cuerpo" tono="secundario" testID="suscripciones-vacio">
          Todavía no veo cargos que se repitan. Cuando un cobro llegue cada mes, cada semana o cada año,
          aparece aquí.
        </Texto>
      )}
      {mensaje ? (
        <Texto
          variante="secundario"
          tono={mensaje.error ? 'faltante' : 'secundario'}
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
              setMensaje({ texto: `Listo: la llamo ${nombre}.`, error: false });
            } catch (e) {
              setMensaje({ texto: mensajeError(e), error: true });
            }
            refrescar();
          }}
        />
      ))}
      {v.textoInactivas ? (
        <Texto variante="secundario" tono="secundario" testID="suscripciones-inactivas">
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
  alHacer: (a: Accion) => void;
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
            etiqueta="Nombre"
            valor={nombre}
            alCambiar={setNombre}
            testID={`${id}-nombre`}
            alEnviar={guardarNombre}
            ayuda="Así la verás en la lista"
          />
        ) : (
          <Texto variante="cuerpoFuerte">{s.nombre}</Texto>
        )}
        {!editandoNombre ? (
          <Boton
            testID={`${id}-editar-nombre`}
            etiqueta="Editar nombre"
            variante="texto"
            ancho="contenido"
            alPresionar={() => setEditandoNombre(true)}
            pista="Cambia cómo la ves en la lista"
          />
        ) : (
          <Boton
            testID={`${id}-guardar-nombre`}
            etiqueta="Guardar nombre"
            variante="secundario"
            alPresionar={guardarNombre}
            pista="Guarda el nombre que escribiste"
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
            Hoy ya la aparta.
          </Texto>
          <Boton
            testID={`${id}-cancelada`}
            etiqueta="Ya la cancelé"
            variante="texto"
            ancho="contenido"
            alPresionar={() => alHacer('cancelada')}
            pista="La quito de la lista; si vuelve a cobrarse, te aviso aquí"
          />
        </View>
      ) : (
        <View style={{ gap: espacio.xs }}>
          <Boton
            testID={`${id}-compromiso`}
            etiqueta="Convertir en compromiso"
            variante="secundario"
            alPresionar={() => alHacer('compromiso')}
            pista="Hoy aparta el monto antes de cada cargo"
          />
          <Boton
            testID={`${id}-cancelada`}
            etiqueta="Ya la cancelé"
            variante="texto"
            ancho="contenido"
            alPresionar={() => alHacer('cancelada')}
            pista="La quito de la lista; si vuelve a cobrarse, te aviso aquí"
          />
          <Boton
            testID={`${id}-no-es`}
            etiqueta="No es suscripción"
            variante="texto"
            ancho="contenido"
            alPresionar={() => alHacer('no_es')}
            pista="Dejo de tratarla como cargo recurrente"
          />
        </View>
      )}
    </Tarjeta>
  );
}
