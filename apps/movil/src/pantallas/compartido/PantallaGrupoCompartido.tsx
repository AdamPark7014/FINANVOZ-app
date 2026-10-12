import { useCallback, useEffect, useState } from 'react';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import {
  anularEventoCompartido,
  AVISO_NO_COMPARTIDO,
  listarCuentas,
  mostrarCodigo,
  obtenerGrupoCompartido,
  registrarPagoCompartido,
  salirDelGrupo,
  sincronizarGrupo,
  unirseConQr,
  type ResultadoAccion,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, etiquetaHablada, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { CodigoQr } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import { FormularioGastoCompartido } from './FormularioGastoCompartido';
import { mensajeErrorCompartido, TEXTO_SALIR } from './textos';

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

  const conResultado = useCallback(
    async (accion: () => Promise<ResultadoAccion>) => {
      setOcupado(true);
      try {
        const r = await accion();
        setError(r.ok ? null : mensajeErrorCompartido(r.error));
        return r.ok;
      } catch {
        setError('No pude hablar con el servidor. Intenta de nuevo en un rato.');
        return false;
      } finally {
        setOcupado(false);
        refrescar();
      }
    },
    [refrescar],
  );

  const sincronizar = useCallback(
    () => conResultado(() => sincronizarGrupo(ctx, deps, grupoId)),
    [conResultado, ctx, deps, grupoId],
  );

  // Al abrir: sincroniza en segundo plano (sin bloquear la pantalla) y vuelve a leer la vista.
  useEffect(() => {
    let vivo = true;
    sincronizarGrupo(ctx, deps, grupoId)
      .then((r) => {
        if (!vivo) return;
        setError(r.ok ? null : mensajeErrorCompartido(r.error));
        refrescar();
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ctx, deps, grupoId, refrescar]);

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
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    trasCambio();
  };

  const anular = (eventoId: string) => {
    try {
      anularEventoCompartido(ctx, deps, grupoId, eventoId);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    trasCambio();
  };

  return (
    <Pantalla testID="pantalla-grupo-compartido" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="grupo-volver"
        etiqueta="Volver"
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
          {g.pendientes === 1 ? '1 movimiento por compartir' : `${g.pendientes} movimientos por compartir`}
        </Texto>
      ) : null}
      <MensajeError texto={error} />

      {g.revincular && panel !== 'revincular' ? (
        <Tarjeta testID="grupo-revincular">
          <Texto variante="cuerpo">
            {`Este teléfono ya no está vinculado al grupo. Pídele a ${g.nombre} que toque "Mostrar código" y escanéalo.`}
          </Texto>
          <Boton
            testID="grupo-revincular-escanear"
            etiqueta="Volver a vincular"
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
          <TextoCifras
            texto={
              g.saldo.debe === 'yo'
                ? `Registra que le pagaste ${formatearCentavos(g.saldo.monto)} a ${g.nombre}.`
                : `Registra que ${g.nombre} te pagó ${formatearCentavos(g.saldo.monto)}.`
            }
          />
          {cuentas.length > 0 ? (
            <Chips
              testID="grupo-saldar-cuenta"
              etiqueta={g.saldo.debe === 'yo' ? '¿Con qué pagaste?' : '¿A dónde te llegó?'}
              opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              valor={cuentaPago}
              alCambiar={setCuentaPago}
            />
          ) : null}
          <Boton testID="grupo-saldar-confirmar" etiqueta="Registrar pago" alPresionar={saldar} />
        </Tarjeta>
      ) : null}

      {panel === 'codigo' && qr ? (
        <Tarjeta testID="grupo-codigo">
          <Texto variante="cuerpo">
            {`Pídele a ${g.nombre} que toque "Volver a vincular" y escanee este código. Sirve una sola vez y vence en 10 minutos.`}
          </Texto>
          <CodigoQr texto={qr} testID="grupo-qr" />
        </Tarjeta>
      ) : null}

      {panel === 'salir' ? (
        <Tarjeta testID="grupo-salir">
          <Texto variante="cuerpo">{TEXTO_SALIR}</Texto>
          <Boton
            testID="grupo-salir-confirmar"
            etiqueta="Dejar de compartir"
            cargando={ocupado}
            alPresionar={() => {
              void conResultado(() => salirDelGrupo(ctx, deps, grupoId)).then((ok) => {
                if (ok) setPanel('ninguno');
              });
            }}
          />
          <Boton
            testID="grupo-salir-cancelar"
            etiqueta="Cancelar"
            variante="texto"
            alPresionar={() => setPanel('ninguno')}
          />
        </Tarjeta>
      ) : null}

      {g.abierto && panel === 'ninguno' && !g.revincular ? (
        <>
          <Boton testID="grupo-agregar" etiqueta="Agregar gasto" alPresionar={() => setPanel('agregar')} />
          {g.saldo.debe !== null ? (
            <Boton
              testID="grupo-saldar-abrir"
              etiqueta="Saldar"
              variante="secundario"
              alPresionar={() => setPanel('saldar')}
            />
          ) : null}
          <Boton
            testID="grupo-mostrar-codigo"
            etiqueta="Mostrar código"
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
                .catch(() => setError('No pude hablar con el servidor. Intenta de nuevo en un rato.'))
                .finally(() => setOcupado(false));
            }}
          />
        </>
      ) : null}

      <Texto variante="subtitulo">Lo compartido</Texto>
      {g.movimientos.length === 0 ? (
        <Texto variante="cuerpo" tono="secundario">
          Todavía no hay gastos compartidos.
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
              Anulado
            </Texto>
          ) : null}
          {m.pendiente ? (
            <Texto variante="secundario" tono="secundario">
              Por compartir
            </Texto>
          ) : null}
          {m.anulable && panel === 'ninguno' ? (
            <Boton
              testID={`mov-compartido-${m.id}-anular`}
              etiqueta="Anular"
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
          etiqueta="Dejar de compartir"
          variante="texto"
          alPresionar={() => setPanel('salir')}
        />
      ) : null}
    </Pantalla>
  );
}
