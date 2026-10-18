import { useState } from 'react';
import { View } from 'react-native';
import {
  archivarTanda,
  detalleTanda,
  editarTanda,
  listarCuentas,
  type DetalleTanda,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { Chips, MensajeError } from '../onboarding/componentes';
import { Seccion } from '../tarjetas/componentes';
import { codigoError, mensajeError } from '../principal/textos';
import { ElegirCuentaTanda, MeTocoLaTanda, useYaLaDi } from './componentes';
import {
  ETIQUETA_ARCHIVAR_TANDA,
  ETIQUETA_CANCELAR,
  ETIQUETA_CUENTA_APORTACION,
  ETIQUETA_CUENTA_PREGUNTAR,
  ETIQUETA_EDITAR_NOMBRE_CUENTA,
  ETIQUETA_GUARDAR_CAMBIOS,
  ETIQUETA_ME_TOCO,
  ETIQUETA_NOMBRE,
  ETIQUETA_VOLVER,
  PISTA_ARCHIVAR_TANDA,
  PISTA_CANCELAR_ARCHIVAR,
  PISTA_CANCELAR_EDICION,
  PISTA_CONFIRMAR_ARCHIVAR,
  PISTA_EDITAR_NOMBRE_CUENTA,
  PISTA_GUARDAR_CAMBIOS,
  PISTA_ME_TOCO,
  PISTA_VOLVER_DETALLE,
  PISTA_YA_LA_DI,
  ETIQUETA_YA_LA_DI,
  ACCESIBILIDAD_TANDA_ARCHIVADA,
  ACCESIBILIDAD_TANDA_NO_ENCONTRADA,
  ERROR_NOMBRE_TANDA_VACIO,
  etiquetaAccesibleCobroDetalle,
  etiquetaAccesibleConfirmarArchivar,
  etiquetaAccesibleProximaAportacionDetalle,
  etiquetaAccesibleResumenDetalleTanda,
  etiquetaAccesibleRondaTanda,
  etiquetaAccesibleSubtituloDetalleTanda,
  etiquetaEstadoRonda,
  TEXTO_CONFIRMAR_ARCHIVAR,
  TEXTO_NO_ES_INGRESO,
  TEXTO_TANDA_ARCHIVADA,
  TEXTO_TANDA_NO_ENCONTRADA,
  textoAportado,
  textoCobras,
  textoDespuesRondaRiesgo,
  textoEnRiesgo,
  textoLineaRonda,
  textoPorAportar,
  textoProximaAportacion,
  textoSubtituloTanda,
  TITULO_CALENDARIO,
} from './textos';

/**
 * Detalle de una tanda (`02 §18`): calendario de rondas con la tuya marcada (E11), "Llevas $1,500 aportados",
 * "Si la tanda se cae, arriesgas $1,500" (`en_riesgo`) y, después de cobrar, "Te faltan $3,000 por aportar".
 * "Ya la di" registra la próxima aportación; "Me tocó la tanda", el cobro (no es ingreso).
 */
function existeTanda(ctx: Parameters<typeof detalleTanda>[0], id: string): boolean {
  try {
    detalleTanda(ctx, id);
    return true;
  } catch (e) {
    if (codigoError(e) === 'tanda_inexistente') return false;
    throw e;
  }
}

export function PantallaTanda({ tandaId, alVolver }: { tandaId: string; alVolver: () => void }) {
  const existe = useVista((ctx) => existeTanda(ctx, tandaId));
  if (!existe) {
    return (
      <Pantalla testID="pantalla-tanda" bordes={['top', 'left', 'right', 'bottom']}>
        <Boton
          testID="tanda-volver"
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          alPresionar={alVolver}
          pista={PISTA_VOLVER_DETALLE}
        />
        <Texto
          variante="cuerpo"
          tono="secundario"
          testID="tanda-no-encontrada"
          accessibilityLabel={ACCESIBILIDAD_TANDA_NO_ENCONTRADA}
          accessibilityLiveRegion="polite"
        >
          {TEXTO_TANDA_NO_ENCONTRADA}
        </Texto>
      </Pantalla>
    );
  }
  return <Detalle tandaId={tandaId} alVolver={alVolver} />;
}

function Detalle({ tandaId, alVolver }: { tandaId: string; alVolver: () => void }) {
  const d = useVista((ctx) => detalleTanda(ctx, tandaId));
  const [cobrando, setCobrando] = useState(false);
  const ya = useYaLaDi(tandaId, d.proxima?.fecha ?? null, 'tanda-ya-la-di');
  return (
    <Pantalla testID="pantalla-tanda" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="tanda-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista={PISTA_VOLVER_DETALLE}
      />
      <View style={{ gap: espacio.xxs }}>
        <Texto variante="titulo" testID="tanda-titulo" accessibilityRole="header">
          {d.nombre}
        </Texto>
        {!d.activa ? (
          <Texto
            variante="secundario"
            tono="secundario"
            testID="tanda-archivada"
            accessibilityLabel={ACCESIBILIDAD_TANDA_ARCHIVADA}
            accessibilityLiveRegion="polite"
          >
            {TEXTO_TANDA_ARCHIVADA}
          </Texto>
        ) : null}
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLabel={etiquetaAccesibleSubtituloDetalleTanda(d.aportacion, d.participantes, d.turno)}
        >
          {textoSubtituloTanda(d.aportacion, d.participantes, d.turno)}
        </Texto>
      </View>

      <Resumen d={d} />

      {d.activa && d.proxima ? (
        <Tarjeta>
          <Texto
            variante="cuerpo"
            accessibilityLabel={etiquetaAccesibleProximaAportacionDetalle(d.proxima.etiqueta)}
          >
            {textoProximaAportacion(d.proxima.etiqueta)}
          </Texto>
          {ya.elegir ?? (
            <Boton
              testID="tanda-ya-la-di"
              etiqueta={ETIQUETA_YA_LA_DI}
              alPresionar={() => ya.dar()}
              pista={PISTA_YA_LA_DI}
            />
          )}
          {ya.error ? (
            <Texto
              variante="secundario"
              tono="faltante"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={ya.error}
            >
              {ya.error}
            </Texto>
          ) : null}
        </Tarjeta>
      ) : null}

      {d.activa && !d.cobrada ? (
        <Tarjeta>
          <Texto
            variante="cuerpo"
            accessibilityLabel={etiquetaAccesibleCobroDetalle(d.cobro, d.etiquetaCobro)}
          >
            {textoCobras(d.cobro, d.etiquetaCobro)}
          </Texto>
          {cobrando ? (
            <MeTocoLaTanda tandaId={tandaId} testID="tanda-me-toco" alTerminar={() => setCobrando(false)} />
          ) : (
            <Boton
              testID="tanda-me-toco"
              etiqueta={ETIQUETA_ME_TOCO}
              variante="secundario"
              alPresionar={() => setCobrando(true)}
              pista={PISTA_ME_TOCO}
            />
          )}
          <Texto variante="secundario" tono="secundario" importantForAccessibility="no">
            {TEXTO_NO_ES_INGRESO}
          </Texto>
        </Tarjeta>
      ) : null}

      {d.activa ? <Ajustes tandaId={tandaId} d={d} alArchivar={alVolver} /> : null}

      <Seccion titulo={TITULO_CALENDARIO} testID="tanda-calendario">
        <View accessibilityRole="list" style={{ gap: espacio.s }}>
        {d.rondas.map((r) => (
          <Tarjeta key={r.t} testID={`tanda-ronda-${r.t}`}>
            <View
              accessible
              accessibilityLabel={etiquetaAccesibleRondaTanda(r, !d.activa)}
              style={{ gap: espacio.xxs }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
                <Texto
                  variante={r.esCobro ? 'cuerpoFuerte' : 'cuerpo'}
                  style={{ flex: 1 }}
                  importantForAccessibility="no"
                >
                  {textoLineaRonda(r.t, r.etiqueta, r.esCobro)}
                </Texto>
                <Texto variante="secundario" tono="secundario" importantForAccessibility="no">
                  {etiquetaEstadoRonda(r, !d.activa)}
                </Texto>
              </View>
              <Texto
                variante="secundario"
                tono="secundario"
                testID={`tanda-ronda-${r.t}-riesgo`}
                importantForAccessibility="no"
              >
                {textoDespuesRondaRiesgo(r.enRiesgo)}
              </Texto>
            </View>
          </Tarjeta>
        ))}
        </View>
      </Seccion>
    </Pantalla>
  );
}

function Ajustes({
  tandaId,
  d,
  alArchivar,
}: {
  tandaId: string;
  d: DetalleTanda;
  alArchivar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const cuentas = useVista((c) => listarCuentas(c).tienes.filter((x) => x.subtipo !== 'ahorro'));
  const [editando, setEditando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [nombre, setNombre] = useState(d.nombre);
  const [cuentaId, setCuentaId] = useState<string | null>(d.cuentaOrigenId);
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    setError(null);
    try {
      const cambios: { nombre?: string; cuentaId?: string | null } = {};
      const nombreTrim = nombre.trim();
      if (nombreTrim === '') {
        setError(ERROR_NOMBRE_TANDA_VACIO);
        return;
      }
      if (nombreTrim !== d.nombre) cambios.nombre = nombreTrim;
      if (cuentaId !== d.cuentaOrigenId) cambios.cuentaId = cuentaId;
      if (Object.keys(cambios).length === 0) {
        setEditando(false);
        return;
      }
      editarTanda(ctx, tandaId, cambios);
      refrescar();
      setEditando(false);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const archivar = () => {
    setError(null);
    try {
      archivarTanda(ctx, tandaId);
      refrescar();
      alArchivar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (archivando) {
    return (
      <Tarjeta testID="tanda-archivar">
        <Texto variante="cuerpo" accessibilityLabel={etiquetaAccesibleConfirmarArchivar()}>
          {TEXTO_CONFIRMAR_ARCHIVAR}
        </Texto>
        <Boton
          testID="tanda-archivar-confirmar"
          etiqueta={ETIQUETA_ARCHIVAR_TANDA}
          alPresionar={archivar}
          pista={PISTA_CONFIRMAR_ARCHIVAR}
        />
        <Boton
          testID="tanda-archivar-cancelar"
          etiqueta={ETIQUETA_CANCELAR}
          variante="texto"
          alPresionar={() => setArchivando(false)}
          pista={PISTA_CANCELAR_ARCHIVAR}
        />
        {error ? <MensajeError texto={error} /> : null}
      </Tarjeta>
    );
  }

  if (editando) {
    return (
      <Tarjeta testID="tanda-editar">
        <CampoTexto
          testID="tanda-editar-nombre"
          etiqueta={ETIQUETA_NOMBRE}
          valor={nombre}
          alCambiar={setNombre}
        />
        {cuentas.length > 0 ? (
          <Chips
            testID="tanda-editar-cuenta"
            etiqueta={ETIQUETA_CUENTA_APORTACION}
            opciones={[
              { valor: '', etiqueta: ETIQUETA_CUENTA_PREGUNTAR },
              ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
            ]}
            valor={cuentaId ?? ''}
            alCambiar={(v) => setCuentaId(v === '' ? null : v)}
          />
        ) : (
          <ElegirCuentaTanda
            pregunta={ETIQUETA_CUENTA_APORTACION}
            alElegir={(id) => setCuentaId(id)}
            prefijoTestID="tanda-editar-cuenta"
          />
        )}
        <Boton
          testID="tanda-editar-guardar"
          etiqueta={ETIQUETA_GUARDAR_CAMBIOS}
          alPresionar={guardar}
          pista={PISTA_GUARDAR_CAMBIOS}
        />
        <Boton
          testID="tanda-editar-cancelar"
          etiqueta={ETIQUETA_CANCELAR}
          variante="texto"
          alPresionar={() => {
            setNombre(d.nombre);
            setCuentaId(d.cuentaOrigenId);
            setEditando(false);
            setError(null);
          }}
          pista={PISTA_CANCELAR_EDICION}
        />
        {error ? <MensajeError texto={error} /> : null}
      </Tarjeta>
    );
  }

  return (
    <View style={{ gap: espacio.xs }}>
      <Boton
        testID="tanda-editar-abrir"
        etiqueta={ETIQUETA_EDITAR_NOMBRE_CUENTA}
        variante="secundario"
        alPresionar={() => setEditando(true)}
        pista={PISTA_EDITAR_NOMBRE_CUENTA}
      />
      <Boton
        testID="tanda-archivar-abrir"
        etiqueta={ETIQUETA_ARCHIVAR_TANDA}
        variante="texto"
        alPresionar={() => setArchivando(true)}
        pista={PISTA_ARCHIVAR_TANDA}
      />
    </View>
  );
}

function Resumen({ d }: { d: DetalleTanda }) {
  return (
    <Tarjeta testID="tanda-resumen-detalle">
      <View
        accessible
        accessibilityLabel={etiquetaAccesibleResumenDetalleTanda(d)}
        style={{ gap: espacio.xxs }}
      >
        <Texto variante="cuerpo" testID="tanda-aportado" importantForAccessibility="no">
          {textoAportado(d.aportado)}
        </Texto>
        <Texto variante="cuerpoFuerte" testID="tanda-en-riesgo" importantForAccessibility="no">
          {textoEnRiesgo(d.enRiesgo)}
        </Texto>
        {d.cobrada ? (
          <Texto variante="cuerpo" testID="tanda-por-aportar" importantForAccessibility="no">
            {textoPorAportar(d.porAportar)}
          </Texto>
        ) : null}
      </View>
    </Tarjeta>
  );
}
