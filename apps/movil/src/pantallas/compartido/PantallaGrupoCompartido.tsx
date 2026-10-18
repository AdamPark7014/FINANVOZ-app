import { useCallback, useEffect, useState } from 'react';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import {
  anularEventoCompartido,
  AVISO_NO_COMPARTIDO,
  listarCuentas,
  MENSAJE_SERVIDOR,
  mensajeError,
  mensajeErrorCompartido,
  mostrarCodigo,
  obtenerGrupoCompartido,
  registrarPagoCompartido,
  salirDelGrupo,
  sincronizarGrupo,
  unirseConQr,
  type ErrorAccionCompartido,
  type ResultadoAccion,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, etiquetaHablada, Pantalla, Tarjeta, Texto } from '../../ui';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { CodigoQr } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import { FormularioGastoCompartido } from './FormularioGastoCompartido';
import {
  BTN_AGREGAR_GASTO,
  BTN_ANULAR,
  BTN_CANCELAR,
  BTN_DEJAR_DE_COMPARTIR,
  BTN_MOSTRAR_CODIGO,
  BTN_REGISTRAR_PAGO,
  BTN_SALDAR,
  BTN_VOLVER_A_VINCULAR,
  ETIQUETA_A_DONDE_LLEGO,
  ETIQUETA_ANULADO,
  ETIQUETA_CON_QUE_PAGASTE,
  ETIQUETA_POR_COMPARTIR,
  ETIQUETA_VOLVER,
  instruccionQrMostrarCodigo,
  instruccionRevincularGrupo,
  TEXTO_GRUPO_MOVIMIENTOS_VACIO,
  TEXTO_SALIR,
  textoPendientesCompartir,
  textoRegistroPagoSaldar,
  TITULO_LO_COMPARTIDO,
} from './textos';

type Panel = 'ninguno' | 'agregar' | 'saldar' | 'codigo' | 'revincular' | 'salir';

/** Texto con cifras y su lectura en palabras para TalkBack. */
function TextoCifras({
  texto,
  testID,
  tono,
}: {
  texto: string;
  testID?: string;
  tono?: 'secundario' | 'faltante';
}) {
  return (
    <Texto
      variante="secundario"
      {...(tono ? { tono } : {})}
      {...(testID ? { testID } : {})}
      accessibilityLabel={etiquetaHablada(texto)}
    >
      {texto}
    </Texto>
  );
}

/**
 * Detalle de un grupo compartido (`02 §27`): saldo ("Le debes $1,600.01 a Ana"), Agregar, Saldar, Mostrar código,
 * Volver a vincular, Dejar de compartir y la lista de lo compartido. Al abrir y después de cada cambio sincroniza.
 */
export function PantallaGrupoCompartido({ grupoId, alVolver }: { grupoId: string; alVolver: () => void }) {
  const { ctx, refrescar } = useSesion();
  const deps = useCompartido();
  const g = useVista((c) => obtenerGrupoCompartido(c, deps.almacen, grupoId));
  const cuentas = useVista((c) => listarCuentas(c).tienes.filter((x) => x.subtipo !== 'ahorro'));
  const [panel, setPanel] = useState<Panel>('ninguno');
  const [qr, setQr] = useState<string | null>(null);
  const [cuentaPago, setCuentaPago] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Lo pendiente se comparte solo al volver la red; si no queda nada pendiente, no hay nada que reintentar.
  const errorAlSincronizar = useCallback(
    (e: ErrorAccionCompartido) =>
      mensajeErrorCompartido(e, {
        reintenta: obtenerGrupoCompartido(ctx, deps.almacen, grupoId).pendientes > 0,
      }),
    [ctx, deps, grupoId],
  );

  const conResultado = useCallback(
    async (
      accion: () => Promise<ResultadoAccion>,
      mensaje: (e: ErrorAccionCompartido) => string = mensajeErrorCompartido,
    ) => {
      setOcupado(true);
      try {
        const r = await accion();
        setError(r.ok ? null : mensaje(r.error));
        return r.ok;
      } catch (e) {
        setError(mensajeError(e, MENSAJE_SERVIDOR));
        return false;
      } finally {
        setOcupado(false);
        refrescar();
      }
    },
    [refrescar],
  );

  const sincronizar = useCallback(
    () => conResultado(() => sincronizarGrupo(ctx, deps, grupoId), errorAlSincronizar),
    [conResultado, ctx, deps, grupoId, errorAlSincronizar],
  );

  // Al abrir: sincroniza en segundo plano (sin bloquear la pantalla) y vuelve a leer la vista.
  useEffect(() => {
    let vivo = true;
    sincronizarGrupo(ctx, deps, grupoId)
      .then((r) => {
        if (!vivo) return;
        setError(r.ok ? null : errorAlSincronizar(r.error));
        refrescar();
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ctx, deps, grupoId, refrescar, errorAlSincronizar]);

  const trasCambio = () => {
    setPanel('ninguno');
    refrescar();
    void sincronizar();
  };

  const saldar = () => {
    if (g.saldo.debe === null) return;
    try {
      registrarPagoCompartido(ctx, deps, grupoId, {
        monto: g.saldo.monto,
        quien: g.saldo.debe,
        ...(cuentaPago ? { cuentaId: cuentaPago } : {}),
      });
    } catch (e) {
      setError(mensajeError(e, ERROR_GUARDAR));
      return;
    }
    trasCambio();
  };

  const anular = (eventoId: string) => {
    try {
      anularEventoCompartido(ctx, deps, grupoId, eventoId);
    } catch (e) {
      setError(mensajeError(e, ERROR_GUARDAR));
      return;
    }
    trasCambio();
  };

  return (
    <Pantalla testID="pantalla-grupo-compartido" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="grupo-volver"
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={panel === 'ninguno' ? alVolver : () => setPanel('ninguno')}
      />
      <Texto variante="titulo">{g.nombre}</Texto>
      <Texto variante="subtitulo" testID="grupo-saldo" accessibilityLabel={etiquetaHablada(g.saldo.texto)}>
        {g.saldo.texto}
      </Texto>
      {g.avisoCierre ? (
        <Texto variante="cuerpo" testID="grupo-aviso-cierre">
          {g.avisoCierre}
        </Texto>
      ) : null}
      {g.pendientes > 0 ? (
        <Texto variante="secundario" tono="secundario" testID="grupo-pendientes">
          {textoPendientesCompartir(g.pendientes)}
        </Texto>
      ) : null}
      <MensajeError texto={error} />

      {g.revincular && panel !== 'revincular' ? (
        <Tarjeta testID="grupo-revincular">
          <Texto variante="cuerpo">{instruccionRevincularGrupo(g.nombre)}</Texto>
          <Boton
            testID="grupo-revincular-escanear"
            etiqueta={BTN_VOLVER_A_VINCULAR}
            alPresionar={() => setPanel('revincular')}
          />
        </Tarjeta>
      ) : null}

      {panel === 'revincular' ? (
        <EscanerQr
          alCancelar={() => setPanel('ninguno')}
          alLeer={(texto) => {
            setPanel('ninguno');
            void conResultado(() => unirseConQr(ctx, deps, texto));
          }}
        />
      ) : null}

      {panel === 'agregar' ? (
        <FormularioGastoCompartido
          grupoId={grupoId}
          nombrePareja={g.nombre}
          alGuardar={trasCambio}
          alCancelar={() => setPanel('ninguno')}
        />
      ) : null}

      {panel === 'saldar' && g.saldo.debe !== null ? (
        <Tarjeta testID="grupo-saldar">
          <TextoCifras texto={textoRegistroPagoSaldar(g.saldo.debe, g.nombre, g.saldo.monto)} />
          {cuentas.length > 0 ? (
            <Chips
              testID="grupo-saldar-cuenta"
              etiqueta={g.saldo.debe === 'yo' ? ETIQUETA_CON_QUE_PAGASTE : ETIQUETA_A_DONDE_LLEGO}
              opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              valor={cuentaPago}
              alCambiar={setCuentaPago}
            />
          ) : null}
          <Boton testID="grupo-saldar-confirmar" etiqueta={BTN_REGISTRAR_PAGO} alPresionar={saldar} />
        </Tarjeta>
      ) : null}

      {panel === 'codigo' && qr ? (
        <Tarjeta testID="grupo-codigo">
          <Texto variante="cuerpo">{instruccionQrMostrarCodigo(g.nombre)}</Texto>
          <CodigoQr texto={qr} testID="grupo-qr" />
        </Tarjeta>
      ) : null}

      {panel === 'salir' ? (
        <Tarjeta testID="grupo-salir">
          <Texto variante="cuerpo">{TEXTO_SALIR}</Texto>
          <Boton
            testID="grupo-salir-confirmar"
            etiqueta={BTN_DEJAR_DE_COMPARTIR}
            cargando={ocupado}
            alPresionar={() => {
              void conResultado(() => salirDelGrupo(ctx, deps, grupoId)).then((ok) => {
                if (ok) setPanel('ninguno');
              });
            }}
          />
          <Boton
            testID="grupo-salir-cancelar"
            etiqueta={BTN_CANCELAR}
            variante="texto"
            alPresionar={() => setPanel('ninguno')}
          />
        </Tarjeta>
      ) : null}

      {g.abierto && panel === 'ninguno' && !g.revincular ? (
        <>
          <Boton testID="grupo-agregar" etiqueta={BTN_AGREGAR_GASTO} alPresionar={() => setPanel('agregar')} />
          {g.saldo.debe !== null ? (
            <Boton
              testID="grupo-saldar-abrir"
              etiqueta={BTN_SALDAR}
              variante="secundario"
              alPresionar={() => setPanel('saldar')}
            />
          ) : null}
          <Boton
            testID="grupo-mostrar-codigo"
            etiqueta={BTN_MOSTRAR_CODIGO}
            variante="secundario"
            cargando={ocupado}
            alPresionar={() => {
              setOcupado(true);
              mostrarCodigo(ctx, deps, grupoId)
                .then((r) => {
                  if (r.ok) {
                    setQr(r.qr);
                    setPanel('codigo');
                    setError(null);
                  } else setError(mensajeErrorCompartido(r.error));
                })
                .catch((e: unknown) => setError(mensajeError(e, MENSAJE_SERVIDOR)))
                .finally(() => setOcupado(false));
            }}
          />
        </>
      ) : null}

      <Texto variante="subtitulo">{TITULO_LO_COMPARTIDO}</Texto>
      {g.movimientos.length === 0 ? (
        <Texto variante="cuerpo" tono="secundario" testID="grupo-movimientos-vacio">
          {TEXTO_GRUPO_MOVIMIENTOS_VACIO}
        </Texto>
      ) : null}
      {g.movimientos.map((m) => (
        <Tarjeta key={m.id} testID={`mov-compartido-${m.id}`}>
          <Texto variante="cuerpoFuerte">{m.titulo}</Texto>
          <TextoCifras
            texto={`${m.fechaTexto} · ${m.detalle}`}
            {...(m.anulado ? { tono: 'secundario' as const } : {})}
          />
          {m.noCompartido ? (
            <Texto variante="secundario" tono="faltante">
              {AVISO_NO_COMPARTIDO}
            </Texto>
          ) : null}
          {m.anulado && !m.noCompartido ? (
            <Texto variante="secundario" tono="secundario">
              {ETIQUETA_ANULADO}
            </Texto>
          ) : null}
          {m.pendiente ? (
            <Texto variante="secundario" tono="secundario">
              {ETIQUETA_POR_COMPARTIR}
            </Texto>
          ) : null}
          {m.anulable && panel === 'ninguno' ? (
            <Boton
              testID={`mov-compartido-${m.id}-anular`}
              etiqueta={BTN_ANULAR}
              variante="texto"
              ancho="contenido"
              alPresionar={() => anular(m.id)}
            />
          ) : null}
        </Tarjeta>
      ))}

      {g.abierto && panel === 'ninguno' ? (
        <Boton
          testID="grupo-salir-abrir"
          etiqueta={BTN_DEJAR_DE_COMPARTIR}
          variante="texto"
          alPresionar={() => setPanel('salir')}
        />
      ) : null}
    </Pantalla>
  );
}
