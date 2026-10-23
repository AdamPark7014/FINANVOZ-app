import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  anularMovimiento,
  descartarPorInterpretar,
  etiquetaDiaMes,
  historialMovimiento,
  listarMovimientos,
  listarPorInterpretar,
  listarTarjetas,
  marcarExtraordinaria,
  mensajeError,
  pasarAMeses,
  type FiltroMovimientos,
  type MovimientoVista,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Boton,
  CampoTexto,
  Cifra,
  espacio,
  etiquetaHablada,
  cifraEnPalabras,
  Pantalla,
  Tarjeta,
  Texto,
} from '../../ui';
import { PorRevisarCapturas } from '../captura/PorRevisarCapturas';
import { leerEntero } from '../onboarding/ingreso';
import { mensajeCompraMsi } from '../tarjetas/textos';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from './Chip';
import { EstadoVacio } from './EstadoVacio';
import { esCorregible, FormularioMovimiento } from './FormularioMovimiento';
import { useAnuncio, useMostrarAviso } from './ProveedorAvisos';
import { mostrarDespuesDeCerrar, useAvisoRegistro } from './useAvisoRegistro';
import {
  BTN_BORRAR_MOVIMIENTO,
  BTN_CERRAR_DETALLE,
  BTN_CONFIRMAR_BORRAR_MOVIMIENTO,
  BTN_CORREGIR_MOVIMIENTO,
  BTN_REGISTRAR_PRIMER_MOVIMIENTO,
  ETIQUETA_CERRAR_DETALLE,
  PISTA_CORREGIR_MOVIMIENTO,
  PISTA_VACIO_MOVIMIENTOS,
  NOMBRE_ORIGEN,
  nombreTipoLibro,
  resumenMovimiento,
  PREGUNTA_PASAR_A_MESES,
  etiquetaEncabezadoDiaMovimientos,
  etiquetaFiltroMovimientosActivo,
  etiquetaIntroPorRevisar,
  etiquetaVacioMovimientos,
  TEXTO_MOVIMIENTOS_FILTRO_ACTIVO,
  TEXTO_MOVIMIENTOS_FILTRO_VACIO,
  TEXTO_MOVIMIENTOS_VACIO,
  TEXTO_POR_REVISAR,
  TITULO_POR_REVISAR,
  MENSAJE_ANULADO_MOVIMIENTO,
  PISTA_ANULAR_MOVIMIENTO,
  PISTA_CONFIRMAR_ANULAR_MOVIMIENTO,
  PISTA_DESCARTAR_FRASE,
  PISTA_MOSTRAR_DETALLE_MOVIMIENTO,
  PISTA_OCULTAR_DETALLE_MOVIMIENTO,
  PISTA_REGISTRAR_MOVIMIENTO,
  PISTA_REVISAR_FRASE,
  PISTA_VER_TODOS_MOVIMIENTOS,
  TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO,
  etiquetaConfirmarAnularMovimiento,
} from './textos';

const INSIGNIA: Record<MovimientoVista['insignias'][number], string> = {
  automatico: 'automático',
  estimado: 'estimado',
  por_asignar: 'por asignar',
  corregido: 'corregido',
};

/** Movimientos (02-UX §10): por revisar arriba, luego agrupados por día; tocar uno muestra el detalle. */
export function PantallaMovimientos({
  alRegistrar,
  alRevisar,
  filtro = null,
  alQuitarFiltro,
  alAbrirPersona,
  detalleInicial = null,
}: {
  alRegistrar: () => void;
  /** Abre Registrar con una frase que la nube ya entendió pero necesita confirmación. */
  alRevisar?: (fraseId: string) => void;
  /** "Ver movimientos" de una consulta (`06 §6`): solo los movimientos que suman en la respuesta. */
  filtro?: FiltroMovimientos | null;
  alQuitarFiltro?: () => void;
  /** Detalle del movimiento → persona (`02 §17`, pendiente 34). */
  alAbrirPersona?: (personaId: string) => void;
  /** Id de transacción a expandir al entrar (p. ej. desde el aviso "Registré…"). */
  detalleInicial?: string | null;
}) {
  const { ctx, version, refrescar } = useSesion();
  const claveFiltro = JSON.stringify(filtro ?? {});
  const dias = useMemo(
    () => listarMovimientos(ctx, filtro ?? {}),
    // `claveFiltro` resume el filtro; `version` relee tras cada escritura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, version, claveFiltro],
  );
  const porRevisar = useVista(listarPorInterpretar);
  // Compras cargadas a una tarjeta de crédito: las únicas que se pueden pasar a meses (02-UX §10).
  const conTarjeta = useVista(
    (ctx) =>
      new Set(
        listarTarjetas(ctx).flatMap((t) =>
          listarMovimientos(ctx, { cuentaId: t.id })
            .flatMap((d) => d.movimientos)
            .filter((m) => m.tipo === 'gasto')
            .map((m) => m.id),
        ),
      ),
  );
  const mostrar = useMostrarAviso();
  const [abierto, setAbierto] = useState<string | null>(detalleInicial);
  // Al llegar otro detalle por la ruta, se abre (ajuste en render, sin efecto).
  const [detallePrevio, setDetallePrevio] = useState(detalleInicial);
  if (detalleInicial !== detallePrevio) {
    setDetallePrevio(detalleInicial);
    if (detalleInicial) setAbierto(detalleInicial);
  }
  // VoiceOver: el aviso de filtro activo se anuncia como en TalkBack (región viva).
  useAnuncio(filtro ? TEXTO_MOVIMIENTOS_FILTRO_ACTIVO : null);

  return (
    <Pantalla testID="pantalla-movimientos">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Texto variante="titulo" testID="movimientos-titulo" accessibilityRole="header">
          Movimientos
        </Texto>
        <Boton
          etiqueta="Registrar"
          ancho="contenido"
          alPresionar={alRegistrar}
          pista={PISTA_REGISTRAR_MOVIMIENTO}
          testID="boton-registrar-movimiento"
        />
      </View>

      {porRevisar.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="por-revisar">
          <Texto variante="subtitulo" testID="movimientos-por-revisar-titulo" accessibilityRole="header">
            {TITULO_POR_REVISAR}
          </Texto>
          <Texto
            variante="secundario"
            tono="secundario"
            testID="movimientos-por-revisar-intro"
            accessibilityLabel={etiquetaIntroPorRevisar()}
          >
            {TEXTO_POR_REVISAR}
          </Texto>
          {/* Las que ya entendí pero necesitan que confirmes algo llevan "Revisar". */}
          {porRevisar.map((f) => (
            <Tarjeta key={f.id} testID={`por-revisar-${f.id}`}>
              <Texto variante="cuerpo">{`«${f.texto}»`}</Texto>
              <Texto variante="secundario" tono="secundario">
                {`${etiquetaDiaMes(f.fecha)} · ${f.origen === 'voz' ? 'dictado' : 'escrito'}${
                  f.estado === 'revisar' ? ' · necesita que la revises' : ''
                }`}
              </Texto>
              {f.estado === 'revisar' && alRevisar ? (
                <Boton
                  etiqueta="Revisar"
                  variante="secundario"
                  ancho="contenido"
                  alPresionar={() => alRevisar(f.id)}
                  pista={PISTA_REVISAR_FRASE}
                  testID={`revisar-${f.id}`}
                />
              ) : alRegistrar ? (
                // Sin intérprete disponible la frase no se resuelve sola: que pueda llenarla a mano.
                <Boton
                  etiqueta="Llenar los datos"
                  variante="secundario"
                  ancho="contenido"
                  alPresionar={alRegistrar}
                  pista={PISTA_REGISTRAR_MOVIMIENTO}
                  testID={`llenar-${f.id}`}
                />
              ) : null}
              <Boton
                etiqueta="Descartar"
                variante="texto"
                ancho="contenido"
                pista={PISTA_DESCARTAR_FRASE}
                alPresionar={() => {
                  try {
                    descartarPorInterpretar(ctx, f.id);
                    refrescar();
                  } catch (e) {
                    mostrar({ mensaje: mensajeError(e) });
                  }
                }}
                testID={`descartar-${f.id}`}
              />
            </Tarjeta>
          ))}
        </View>
      ) : null}

      <PorRevisarCapturas alRegistrar={alRegistrar} />

      {filtro ? (
        <Tarjeta testID="movimientos-filtro">
          <Texto
            variante="secundario"
            accessibilityLabel={etiquetaFiltroMovimientosActivo()}
            accessibilityLiveRegion="polite"
          >
            {TEXTO_MOVIMIENTOS_FILTRO_ACTIVO}
          </Texto>
          {alQuitarFiltro ? (
            <Boton
              etiqueta="Ver todos"
              variante="texto"
              ancho="contenido"
              alPresionar={alQuitarFiltro}
              pista={PISTA_VER_TODOS_MOVIMIENTOS}
              testID="boton-quitar-filtro"
            />
          ) : null}
        </Tarjeta>
      ) : null}

      {dias.length === 0 ? (
        <EstadoVacio
          testID="movimientos-vacio"
          texto={filtro ? TEXTO_MOVIMIENTOS_FILTRO_VACIO : TEXTO_MOVIMIENTOS_VACIO}
          etiquetaAccesible={etiquetaVacioMovimientos(filtro != null)}
          {...(filtro ? {} : { pistaCta: PISTA_VACIO_MOVIMIENTOS })}
        />
      ) : null}
      {dias.length === 0 && !filtro ? (
        <Boton
          etiqueta={BTN_REGISTRAR_PRIMER_MOVIMIENTO}
          variante="secundario"
          alPresionar={alRegistrar}
          pista={PISTA_REGISTRAR_MOVIMIENTO}
          testID="boton-registrar-primer-movimiento"
        />
      ) : null}

      {dias.map((d) => (
        <View key={d.fecha} style={{ gap: espacio.s }}>
          <Texto
            variante="etiqueta"
            tono="secundario"
            accessibilityRole="header"
            accessibilityLabel={etiquetaEncabezadoDiaMovimientos(d.etiqueta)}
            testID={`movimientos-dia-${d.fecha}`}
          >
            {d.etiqueta}
          </Texto>
          <View accessibilityRole="list" testID={`movimientos-lista-${d.fecha}`} style={{ gap: espacio.s }}>
            {d.movimientos.map((m) => (
              <View key={m.id} role="listitem" testID={`movimiento-fila-${m.id}`}>
                <FilaMovimiento
                  m={m}
                  abierto={abierto === m.id}
                  aMeses={conTarjeta.has(m.id)}
                  {...(alAbrirPersona ? { alAbrirPersona } : {})}
                  alAbrirDetalle={(id) => setAbierto(id)}
                  alTocar={() => setAbierto((a) => (a === m.id ? null : m.id))}
                  alCerrar={() => setAbierto(null)}
                  alAnular={() => {
                    try {
                      anularMovimiento(ctx, m.id);
                      setAbierto(null);
                      refrescar();
                      mostrar({ mensaje: MENSAJE_ANULADO_MOVIMIENTO });
                    } catch (e) {
                      mostrar({ mensaje: mensajeError(e) });
                    }
                  }}
                  alExtraordinario={() => {
                    // "Fue algo extraordinario" (`04 §3`, `05 §E8.2`): no cuenta para estimar si llegas.
                    const marcar = !m.extraordinaria;
                    try {
                      marcarExtraordinaria(ctx, m.id, marcar);
                      refrescar();
                      mostrar({
                        mensaje: marcar
                          ? 'Listo: no lo uso para estimar tus gastos de cada día.'
                          : 'Listo: vuelvo a contarlo para estimar tus gastos de cada día.',
                        accion: {
                          etiqueta: 'Deshacer',
                          alPresionar: () => {
                            try {
                              marcarExtraordinaria(ctx, m.id, !marcar);
                              refrescar();
                            } catch (e) {
                              mostrarDespuesDeCerrar(mostrar, mensajeError(e));
                            }
                          },
                        },
                      });
                    } catch (e) {
                      mostrar({ mensaje: mensajeError(e) });
                    }
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

function titulo(m: MovimientoVista): string {
  return m.descripcion ?? m.comercio ?? m.categoria ?? nombreTipoLibro(m.tipo);
}

const MESES_COMUNES = ['3', '6', '9', '12', '18', '24'] as const;

/** "Pasar a meses" (CA-M4-09): cuántos meses y Guardar; el cargo se reemplaza por la compra a meses. */
function PasarAMeses({
  m,
  alTerminar,
  alAbrirDetalle,
}: {
  m: MovimientoVista;
  alTerminar: () => void;
  alAbrirDetalle: (transaccionId: string) => void;
}) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro(alAbrirDetalle);
  const [meses, setMeses] = useState<string | null>(null);
  const [otro, setOtro] = useState('');
  const [error, setError] = useState<string | null>(null);
  useAnuncio(error);
  const guardar = () => {
    const n = meses !== null ? Number(meses) : leerEntero(otro, 2, 48);
    if (n === null) return setError('Elige los meses, de 2 a 48.');
    try {
      const r = pasarAMeses(ctx, m.id, n);
      avisarRegistro(mensajeCompraMsi(r), { deshacer: r.deshacer, transaccionId: r.transaccionId });
      alTerminar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  return (
    <View style={{ gap: espacio.s }} testID={`pasar-a-meses-${m.id}`}>
      <Texto variante="cuerpo" {...OCULTAR_ETIQUETA_VISIBLE}>
        {PREGUNTA_PASAR_A_MESES}
      </Texto>
      <GrupoChips
        opciones={MESES_COMUNES.map((n) => ({ valor: n, etiqueta: `${n} meses` }))}
        valor={meses}
        alCambiar={(n) => {
          setMeses(n);
          setOtro('');
        }}
        prefijoTestID="meses"
        etiqueta={PREGUNTA_PASAR_A_MESES}
      />
      <CampoTexto
        testID="meses-otro"
        etiqueta="Otro número de meses"
        teclado="number-pad"
        valor={otro}
        alCambiar={(t) => {
          setOtro(t);
          setMeses(null);
        }}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Pasar a meses" alPresionar={guardar} testID="boton-confirmar-meses" />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alTerminar} />
    </View>
  );
}

function FilaMovimiento({
  m,
  abierto,
  aMeses,
  alTocar,
  alCerrar,
  alAnular,
  alExtraordinario,
  alAbrirPersona,
  alAbrirDetalle,
}: {
  m: MovimientoVista;
  abierto: boolean;
  aMeses: boolean;
  alTocar: () => void;
  alCerrar: () => void;
  alAnular: () => void;
  alExtraordinario: () => void;
  alAbrirPersona?: (personaId: string) => void;
  alAbrirDetalle: (transaccionId: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pasando, setPasando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  // VoiceOver: la pregunta de borrar se anuncia como en TalkBack (`accessibilityRole="alert"`).
  useAnuncio(abierto && confirmando ? TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO : null);
  const centavos = m.sentido === 'salida' ? -m.monto : m.monto;
  const subtitulo = [m.categoria, ...m.insignias.map((i) => INSIGNIA[i])].filter(Boolean).join(' · ');
  const etiquetaAccesible = etiquetaHablada(
    [titulo(m), subtitulo, cifraEnPalabras(centavos)].filter(Boolean).join(', '),
  );
  const ocupado = pasando || confirmando || corrigiendo;
  const encabezado = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
      <View style={{ flex: 1, gap: espacio.xxs }}>
        <Texto variante="cuerpoFuerte">{titulo(m)}</Texto>
        {subtitulo ? (
          <Texto variante="secundario" tono="secundario">
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      <Cifra centavos={centavos} testID={`monto-${m.id}`} />
    </View>
  );
  return (
    <Tarjeta
      testID={`movimiento-${m.id}`}
      alPresionar={alTocar}
      accionesAnidadas={abierto}
      expandida={abierto}
      etiquetaAccesible={etiquetaAccesible}
      pista={abierto ? PISTA_OCULTAR_DETALLE_MOVIMIENTO : PISTA_MOSTRAR_DETALLE_MOVIMIENTO}
    >
      {abierto ? (
        // Con el detalle abierto, el fondo de la tarjeta queda detrás del texto: el encabezado también la cierra.
        <Pressable
          testID={`encabezado-${m.id}`}
          onPress={alTocar}
          accessibilityRole="button"
          accessibilityLabel={etiquetaAccesible}
          accessibilityHint={PISTA_OCULTAR_DETALLE_MOVIMIENTO}
          accessibilityState={{ expanded: true }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {encabezado}
          </View>
        </Pressable>
      ) : (
        encabezado
      )}
      {abierto ? (
        <View style={{ gap: espacio.xs }} testID={`detalle-${m.id}`}>
          {m.saleDe.length > 0 ? (
            <Texto variante="secundario">{`Salió de: ${m.saleDe.join(', ')}`}</Texto>
          ) : null}
          {m.llegaA.length > 0 ? (
            <Texto variante="secundario">{`Llegó a: ${m.llegaA.join(', ')}`}</Texto>
          ) : null}
          {alAbrirPersona
            ? m.personas.map((p) => (
                <Boton
                  key={p.id}
                  etiqueta={`Ver ${p.nombre}`}
                  variante="texto"
                  ancho="contenido"
                  alPresionar={() => alAbrirPersona(p.id)}
                  testID={`movimiento-persona-${m.id}-${p.id}`}
                />
              ))
            : null}
          {m.categoria ? <Texto variante="secundario">{`Categoría: ${m.categoria}`}</Texto> : null}
          {m.reemplazaA ? <Historial id={m.id} /> : null}
          <Texto variante="secundario" tono="secundario">
            {`${NOMBRE_ORIGEN[m.origen] ?? 'Registrado'} · ${etiquetaDiaMes(m.fecha)}`}
          </Texto>
          {pasando ? (
            <PasarAMeses m={m} alTerminar={() => setPasando(false)} alAbrirDetalle={alAbrirDetalle} />
          ) : null}
          {corrigiendo && esCorregible(m) ? (
            <FormularioMovimiento
              corregir={m}
              alCorregido={(nuevoId) => {
                setCorrigiendo(false);
                // La versión corregida reemplaza a esta: su detalle queda abierto con el historial.
                alAbrirDetalle(nuevoId);
              }}
              alCancelar={() => setCorrigiendo(false)}
            />
          ) : null}
          {esCorregible(m) && !ocupado ? (
            <Boton
              etiqueta={BTN_CORREGIR_MOVIMIENTO}
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setCorrigiendo(true)}
              pista={PISTA_CORREGIR_MOVIMIENTO}
              testID="boton-corregir"
            />
          ) : null}
          {aMeses && !ocupado ? (
            <Boton
              etiqueta="Pasar a meses"
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setPasando(true)}
              testID="boton-pasar-a-meses"
            />
          ) : null}
          {m.tipo === 'gasto' && m.extraordinaria ? (
            <Texto variante="secundario" tono="secundario" testID="nota-extraordinario">
              Lo marcaste como extraordinario
            </Texto>
          ) : null}
          {m.tipo === 'gasto' && !ocupado ? (
            m.extraordinaria ? (
              <Boton
                etiqueta="Volver a contarlo"
                variante="texto"
                ancho="contenido"
                pista="Lo vuelvo a usar para estimar si llegas a tu próximo ingreso"
                alPresionar={alExtraordinario}
                testID="boton-volver-a-contar"
              />
            ) : (
              <Boton
                etiqueta="Fue algo extraordinario"
                variante="texto"
                ancho="contenido"
                pista="No lo uso para estimar si llegas a tu próximo ingreso"
                alPresionar={alExtraordinario}
                testID="boton-extraordinario"
              />
            )
          ) : null}
          {pasando || corrigiendo ? null : confirmando ? (
            <View style={{ gap: espacio.s }} testID={`confirmar-anular-${m.id}`}>
              <Texto
                variante="cuerpo"
                testID={`texto-confirmar-anular-${m.id}`}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                accessibilityLabel={etiquetaConfirmarAnularMovimiento()}
              >
                {TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO}
              </Texto>
              <Boton
                etiqueta={BTN_CONFIRMAR_BORRAR_MOVIMIENTO}
                alPresionar={alAnular}
                pista={PISTA_CONFIRMAR_ANULAR_MOVIMIENTO}
                testID="boton-confirmar-anular"
              />
              <Boton etiqueta="Cancelar" variante="texto" alPresionar={() => setConfirmando(false)} />
            </View>
          ) : (
            <Boton
              etiqueta={BTN_BORRAR_MOVIMIENTO}
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setConfirmando(true)}
              pista={PISTA_ANULAR_MOVIMIENTO}
              testID="boton-anular"
            />
          )}
          {ocupado ? null : (
            <Boton
              etiqueta={BTN_CERRAR_DETALLE}
              etiquetaAccesible={ETIQUETA_CERRAR_DETALLE}
              pista={PISTA_OCULTAR_DETALLE_MOVIMIENTO}
              variante="texto"
              ancho="contenido"
              alPresionar={alCerrar}
              testID={`cerrar-detalle-${m.id}`}
            />
          )}
        </View>
      ) : null}
    </Tarjeta>
  );
}

/** Historial de un movimiento corregido (CA-M3-03): cómo estaba antes de cada cambio. */
function Historial({ id }: { id: string }) {
  const versiones = useVista((ctx) => historialMovimiento(ctx, id));
  if (versiones.length === 0) return null;
  return (
    <View style={{ gap: espacio.xxs }} testID={`historial-${id}`}>
      <Texto variante="secundario" tono="secundario">
        Lo corregiste. Antes:
      </Texto>
      {versiones.map((v) => (
        <Texto key={v.transaccionId} variante="secundario" tono="secundario">
          {`${resumenMovimiento(v)} · ${etiquetaDiaMes(v.fecha)}`}
        </Texto>
      ))}
    </View>
  );
}
