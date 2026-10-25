import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
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
import { anunciar, Boton, espacio, etiquetaHablada, Pantalla, Tarjeta, Texto } from '../../ui';
import { useAnunciarEnIos } from '../avisos/anunciar';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { EstadoVacio } from '../principal/EstadoVacio';
import { CodigoQr } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import { FormularioGastoCompartido } from './FormularioGastoCompartido';
import {
  BTN_AGREGAR_GASTO,
  BTN_ANULAR,
  BTN_CANCELAR,
  BTN_DEJAR_DE_COMPARTIR,
  BTN_LISTO,
  BTN_MOSTRAR_CODIGO,
  BTN_REGISTRAR_PAGO,
  BTN_SALDAR,
  BTN_SI_ANULAR,
  BTN_VOLVER_A_VINCULAR,
  PISTA_AGREGAR_GASTO,
  PISTA_ANULAR_MOVIMIENTO,
  PISTA_CANCELAR_PANEL,
  PISTA_CERRAR_CODIGO,
  PISTA_CONFIRMAR_ANULAR,
  PISTA_CONFIRMAR_SALIR_GRUPO,
  PISTA_DEJAR_DE_COMPARTIR,
  PISTA_MOSTRAR_CODIGO,
  PISTA_REGISTRAR_PAGO,
  PISTA_SALDAR,
  PISTA_VOLVER_A_VINCULAR,
  PISTA_VOLVER_GRUPO,
  textoConfirmarAnular,
  ETIQUETA_A_DONDE_LLEGO,
  ETIQUETA_ANULADO,
  ETIQUETA_CON_QUE_PAGASTE,
  ETIQUETA_POR_COMPARTIR,
  ETIQUETA_VOLVER,
  instruccionQrMostrarCodigo,
  instruccionRevincularGrupo,
  etiquetaVacioGrupoMovimientos,
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
/** Texto cuando el enlace apunta a un grupo que ya no está (lo cerraste, saliste o borraste tus datos). */
export const TEXTO_GRUPO_NO_ENCONTRADO =
  'Este grupo ya no está en tu teléfono. Vuelve a tus gastos compartidos.';

/**
 * Grupo compartido por su id. Un enlace viejo (`/compartido/<id>` de un grupo que ya no existe) antes tumbaba la app
 * (`grupo_inexistente`); ahora dice qué pasó y deja volver, como la tarjeta y la persona.
 */
export function PantallaGrupoCompartido({
  grupoId,
  alVolver,
}: {
  grupoId: string;
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
}) {
  const deps = useCompartido();
  const existe = useVista((c) => {
    try {
      obtenerGrupoCompartido(c, deps.almacen, grupoId);
      return true;
    } catch {
      return false;
    }
  });
  if (!existe) {
    return (
      <Pantalla
        testID="pantalla-grupo-compartido"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        {alVolver ? (
          <Boton
            testID="grupo-volver"
            etiqueta={ETIQUETA_VOLVER}
            variante="texto"
            ancho="contenido"
            pista={PISTA_VOLVER_GRUPO}
            alPresionar={alVolver}
          />
        ) : null}
        <Texto variante="cuerpo" tono="secundario" testID="grupo-no-encontrado">
          {TEXTO_GRUPO_NO_ENCONTRADO}
        </Texto>
      </Pantalla>
    );
  }
  return <GrupoCompartido grupoId={grupoId} {...(alVolver ? { alVolver } : {})} />;
}

function GrupoCompartido({ grupoId, alVolver }: { grupoId: string; alVolver?: () => void }) {
  const { ctx, refrescar } = useSesion();
  const deps = useCompartido();
  const g = useVista((c) => obtenerGrupoCompartido(c, deps.almacen, grupoId));
  const cuentas = useVista((c) => listarCuentas(c).tienes.filter((x) => x.subtipo !== 'ahorro'));
  const [panel, setPanel] = useState<Panel>('ninguno');
  const [qr, setQr] = useState<string | null>(null);
  const [cuentaPago, setCuentaPago] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** Movimiento que espera "Sí, anular" (anular no tiene Deshacer). */
  const [anulando, setAnulando] = useState<string | null>(null);
  // Sin cliente de nube no hay código, ni volver a vincular, ni salir: el aviso sale al abrir (sincronizar).
  const conServicio = deps.cliente !== null;
  useAnunciarEnIos(error);

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
    setAnulando(null);
    try {
      anularEventoCompartido(ctx, deps, grupoId, eventoId);
    } catch (e) {
      setError(mensajeError(e, ERROR_GUARDAR));
      return;
    }
    trasCambio();
  };

  return (
    <Pantalla
      testID="pantalla-grupo-compartido"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      {alVolver ? (
        <Boton
          testID="grupo-volver"
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          pista={PISTA_VOLVER_GRUPO}
          alPresionar={alVolver}
        />
      ) : null}
      <Texto variante="titulo" testID="grupo-titulo" accessibilityRole="header">
        {g.nombre}
      </Texto>
      <Texto variante="subtitulo" testID="grupo-saldo" accessibilityLabel={etiquetaHablada(g.saldo.texto)}>
        {g.saldo.texto}
      </Texto>
      {g.avisoCierre ? (
        <Texto
          variante="cuerpo"
          testID="grupo-aviso-cierre"
          accessibilityLiveRegion="polite"
          importantForAccessibility="yes"
        >
          {g.avisoCierre}
        </Texto>
      ) : null}
      {g.pendientes > 0 ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID="grupo-pendientes"
          accessibilityLabel={etiquetaHablada(textoPendientesCompartir(g.pendientes))}
        >
          {textoPendientesCompartir(g.pendientes)}
        </Texto>
      ) : null}
      <MensajeError texto={error} />

      {g.revincular && conServicio && panel !== 'revincular' ? (
        <Tarjeta testID="grupo-revincular">
          <Texto variante="cuerpo">{instruccionRevincularGrupo(g.nombre)}</Texto>
          <Boton
            testID="grupo-revincular-escanear"
            etiqueta={BTN_VOLVER_A_VINCULAR}
            pista={PISTA_VOLVER_A_VINCULAR}
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
          <Boton
            testID="grupo-saldar-confirmar"
            etiqueta={BTN_REGISTRAR_PAGO}
            pista={PISTA_REGISTRAR_PAGO}
            alPresionar={saldar}
          />
          <Boton
            testID="grupo-saldar-cancelar"
            etiqueta={BTN_CANCELAR}
            variante="texto"
            pista={PISTA_CANCELAR_PANEL}
            alPresionar={() => setPanel('ninguno')}
          />
        </Tarjeta>
      ) : null}

      {panel === 'codigo' && qr ? (
        <Tarjeta testID="grupo-codigo">
          <Texto variante="cuerpo">{instruccionQrMostrarCodigo(g.nombre)}</Texto>
          <CodigoQr texto={qr} testID="grupo-qr" />
          <Boton
            testID="grupo-codigo-listo"
            etiqueta={BTN_LISTO}
            variante="secundario"
            pista={PISTA_CERRAR_CODIGO}
            alPresionar={() => setPanel('ninguno')}
          />
        </Tarjeta>
      ) : null}

      {panel === 'salir' ? (
        <Tarjeta testID="grupo-salir">
          <Texto variante="cuerpo">{TEXTO_SALIR}</Texto>
          <Boton
            testID="grupo-salir-confirmar"
            etiqueta={BTN_DEJAR_DE_COMPARTIR}
            pista={PISTA_CONFIRMAR_SALIR_GRUPO}
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
            pista={PISTA_CANCELAR_PANEL}
            alPresionar={() => setPanel('ninguno')}
          />
        </Tarjeta>
      ) : null}

      {g.abierto && panel === 'ninguno' && !g.revincular ? (
        <>
          <Boton
            testID="grupo-agregar"
            etiqueta={BTN_AGREGAR_GASTO}
            pista={PISTA_AGREGAR_GASTO}
            alPresionar={() => setPanel('agregar')}
          />
          {g.saldo.debe !== null ? (
            <Boton
              testID="grupo-saldar-abrir"
              etiqueta={BTN_SALDAR}
              variante="secundario"
              pista={PISTA_SALDAR}
              alPresionar={() => setPanel('saldar')}
            />
          ) : null}
          {conServicio ? (
            <Boton
              testID="grupo-mostrar-codigo"
              etiqueta={BTN_MOSTRAR_CODIGO}
              variante="secundario"
              pista={PISTA_MOSTRAR_CODIGO}
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
          ) : null}
        </>
      ) : null}

      <Texto variante="subtitulo" testID="grupo-lo-compartido-titulo" accessibilityRole="header">
        {TITULO_LO_COMPARTIDO}
      </Texto>
      {g.movimientos.length === 0 ? (
        <EstadoVacio
          texto={TEXTO_GRUPO_MOVIMIENTOS_VACIO}
          testID="grupo-movimientos-vacio"
          etiquetaAccesible={etiquetaVacioGrupoMovimientos()}
        />
      ) : null}
      {g.movimientos.map((m) => (
        <Tarjeta key={m.id} testID={`mov-compartido-${m.id}`}>
          <Texto variante="cuerpoFuerte" accessibilityRole="header">
            {m.titulo}
          </Texto>
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
          {m.anulable && panel === 'ninguno' && anulando === m.id ? (
            <View style={{ gap: espacio.s }} testID={`mov-compartido-${m.id}-confirmacion`}>
              <Texto variante="cuerpo" accessibilityLiveRegion="polite">
                {textoConfirmarAnular(m.titulo, g.nombre)}
              </Texto>
              <Boton
                testID={`mov-compartido-${m.id}-confirmar-anular`}
                etiqueta={BTN_SI_ANULAR}
                variante="secundario"
                pista={PISTA_CONFIRMAR_ANULAR}
                alPresionar={() => anular(m.id)}
              />
              <Boton
                testID={`mov-compartido-${m.id}-cancelar-anular`}
                etiqueta={BTN_CANCELAR}
                variante="texto"
                pista={PISTA_CANCELAR_PANEL}
                alPresionar={() => setAnulando(null)}
              />
            </View>
          ) : m.anulable && panel === 'ninguno' ? (
            <Boton
              testID={`mov-compartido-${m.id}-anular`}
              etiqueta={BTN_ANULAR}
              variante="texto"
              ancho="contenido"
              pista={PISTA_ANULAR_MOVIMIENTO}
              alPresionar={() => {
                setAnulando(m.id);
                anunciar(etiquetaHablada(textoConfirmarAnular(m.titulo, g.nombre)));
              }}
            />
          ) : null}
        </Tarjeta>
      ))}

      {g.abierto && conServicio && panel === 'ninguno' ? (
        <Boton
          testID="grupo-salir-abrir"
          etiqueta={BTN_DEJAR_DE_COMPARTIR}
          variante="texto"
          pista={PISTA_DEJAR_DE_COMPARTIR}
          alPresionar={() => setPanel('salir')}
        />
      ) : null}
    </Pantalla>
  );
}
