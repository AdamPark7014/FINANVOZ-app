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
import { Boton, CampoTexto, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
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
  ETIQUETA_YA_LA_DI,
  ERROR_NOMBRE_TANDA_VACIO,
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
        <Boton etiqueta={ETIQUETA_VOLVER} variante="texto" ancho="contenido" alPresionar={alVolver} />
        <Texto variante="cuerpo" tono="secundario" testID="tanda-no-encontrada">
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
        etiqueta="Volver"
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
      />
      <View style={{ gap: espacio.xxs }}>
        <Texto variante="titulo" testID="tanda-titulo">
          {d.nombre}
        </Texto>
        {!d.activa ? (
          <Texto variante="secundario" tono="secundario" testID="tanda-archivada">
            Archivada · ya no aparto aportaciones
          </Texto>
        ) : null}
        <Texto variante="secundario" tono="secundario">
          {`${formatearCentavos(d.aportacion)} por ronda · ${d.participantes} participantes · tu turno: ${d.turno}`}
        </Texto>
      </View>

      <Resumen d={d} />

      {d.activa && d.proxima ? (
        <Tarjeta>
          <Texto variante="cuerpo">{`Próxima aportación: ${d.proxima.etiqueta}`}</Texto>
          {ya.elegir ?? <Boton testID="tanda-ya-la-di" etiqueta="Ya la di" alPresionar={() => ya.dar()} />}
          {ya.error ? (
            <Texto variante="secundario" tono="faltante">
              {ya.error}
            </Texto>
          ) : null}
        </Tarjeta>
      ) : null}

      {d.activa && !d.cobrada ? (
        <Tarjeta>
          <Texto variante="cuerpo">{`Cobras ${formatearCentavos(d.cobro)} el ${d.etiquetaCobro}.`}</Texto>
          {cobrando ? (
            <MeTocoLaTanda tandaId={tandaId} testID="tanda-me-toco" alTerminar={() => setCobrando(false)} />
          ) : (
            <Boton
              testID="tanda-me-toco"
              etiqueta="Me tocó la tanda"
              variante="secundario"
              alPresionar={() => setCobrando(true)}
            />
          )}
          <Texto variante="secundario" tono="secundario">
            {TEXTO_NO_ES_INGRESO}
          </Texto>
        </Tarjeta>
      ) : null}

      {d.activa ? <Ajustes tandaId={tandaId} d={d} alArchivar={alVolver} /> : null}

      <Seccion titulo="Calendario" testID="tanda-calendario">
        {d.rondas.map((r) => (
          <Tarjeta key={r.t} testID={`tanda-ronda-${r.t}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
              <Texto variante={r.esCobro ? 'cuerpoFuerte' : 'cuerpo'} style={{ flex: 1 }}>
                {`${r.t}. ${r.etiqueta}${r.esCobro ? ' · tu turno' : ''}`}
              </Texto>
              <Texto variante="secundario" tono="secundario">
                {etiquetaRonda(r, !d.activa)}
              </Texto>
            </View>
            <Texto variante="secundario" tono="secundario" testID={`tanda-ronda-${r.t}-riesgo`}>
              {`Después de esta ronda arriesgas ${formatearCentavos(r.enRiesgo)}`}
            </Texto>
          </Tarjeta>
        ))}
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
        setError('Escribe un nombre para la tanda.');
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
        <Texto variante="cuerpo">
          Archivar quita la tanda de tu lista y cancela las aportaciones que faltaban. Lo que ya registraste se
          queda.
        </Texto>
        <Boton testID="tanda-archivar-confirmar" etiqueta="Archivar tanda" alPresionar={archivar} />
        <Boton
          testID="tanda-archivar-cancelar"
          etiqueta="Cancelar"
          variante="texto"
          alPresionar={() => setArchivando(false)}
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
          etiqueta="Nombre"
          valor={nombre}
          alCambiar={setNombre}
        />
        {cuentas.length > 0 ? (
          <Chips
            testID="tanda-editar-cuenta"
            etiqueta="¿De qué cuenta sale la aportación?"
            opciones={[
              { valor: '', etiqueta: 'Pregúntame cada vez' },
              ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
            ]}
            valor={cuentaId ?? ''}
            alCambiar={(v) => setCuentaId(v === '' ? null : v)}
          />
        ) : (
          <ElegirCuentaTanda
            pregunta="¿De qué cuenta sale la aportación?"
            alElegir={(id) => setCuentaId(id)}
            prefijoTestID="tanda-editar-cuenta"
          />
        )}
        <Boton testID="tanda-editar-guardar" etiqueta="Guardar cambios" alPresionar={guardar} />
        <Boton
          testID="tanda-editar-cancelar"
          etiqueta="Cancelar"
          variante="texto"
          alPresionar={() => {
            setNombre(d.nombre);
            setCuentaId(d.cuentaOrigenId);
            setEditando(false);
            setError(null);
          }}
        />
        {error ? <MensajeError texto={error} /> : null}
      </Tarjeta>
    );
  }

  return (
    <View style={{ gap: espacio.xs }}>
      <Boton
        testID="tanda-editar-abrir"
        etiqueta="Editar nombre o cuenta"
        variante="secundario"
        alPresionar={() => setEditando(true)}
      />
      <Boton
        testID="tanda-archivar-abrir"
        etiqueta="Archivar tanda"
        variante="texto"
        alPresionar={() => setArchivando(true)}
      />
    </View>
  );
}

function Resumen({ d }: { d: DetalleTanda }) {
  return (
    <Tarjeta testID="tanda-resumen-detalle">
      <Texto variante="cuerpo" testID="tanda-aportado">
        {textoAportado(d.aportado)}
      </Texto>
      <Texto variante="cuerpoFuerte" testID="tanda-en-riesgo">
        {textoEnRiesgo(d.enRiesgo)}
      </Texto>
      {d.cobrada ? (
        <Texto variante="cuerpo" testID="tanda-por-aportar">
          {textoPorAportar(d.porAportar)}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
