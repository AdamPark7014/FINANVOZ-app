import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
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
import { useMostrarAviso } from './ProveedorAvisos';
import { useAvisoRegistro } from './useAvisoRegistro';
import {
  NOMBRE_ORIGEN,
  NOMBRE_TIPO_LIBRO,
  resumenMovimiento,
  PREGUNTA_PASAR_A_MESES,
  etiquetaVacioMovimientos,
  TEXTO_MOVIMIENTOS_FILTRO_ACTIVO,
  TEXTO_MOVIMIENTOS_FILTRO_VACIO,
  TEXTO_MOVIMIENTOS_VACIO,
  TEXTO_POR_REVISAR,
  TITULO_POR_REVISAR,
  MENSAJE_ANULADO_MOVIMIENTO,
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

  useEffect(() => {
    if (detalleInicial) setAbierto(detalleInicial);
  }, [detalleInicial]);

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
        <Texto variante="titulo">Movimientos</Texto>
        <Boton
          etiqueta="Registrar"
          ancho="contenido"
          alPresionar={alRegistrar}
          testID="boton-registrar-movimiento"
        />
      </View>

      {porRevisar.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="por-revisar">
          <Texto variante="subtitulo">{TITULO_POR_REVISAR}</Texto>
          <Texto variante="secundario" tono="secundario">
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
                  testID={`revisar-${f.id}`}
                />
              ) : null}
              <Boton
                etiqueta="Descartar"
                variante="texto"
                ancho="contenido"
                alPresionar={() => {
                  descartarPorInterpretar(ctx, f.id);
                  refrescar();
                }}
              />
            </Tarjeta>
          ))}
        </View>
      ) : null}

      <PorRevisarCapturas alRegistrar={alRegistrar} />

      {filtro ? (
        <Tarjeta testID="movimientos-filtro">
          <Texto variante="secundario">{TEXTO_MOVIMIENTOS_FILTRO_ACTIVO}</Texto>
          {alQuitarFiltro ? (
            <Boton
              etiqueta="Ver todos"
              variante="texto"
              ancho="contenido"
              alPresionar={alQuitarFiltro}
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
        />
      ) : null}

      {dias.map((d) => (
        <View key={d.fecha} style={{ gap: espacio.s }}>
          <Texto variante="etiqueta" tono="secundario" accessibilityRole="header">
            {d.etiqueta}
          </Texto>
          {d.movimientos.map((m) => (
            <FilaMovimiento
              key={m.id}
              m={m}
              abierto={abierto === m.id}
              aMeses={conTarjeta.has(m.id)}
              {...(alAbrirPersona ? { alAbrirPersona } : {})}
              alAbrirDetalle={(id) => setAbierto(id)}
              alTocar={() => setAbierto((a) => (a === m.id ? null : m.id))}
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
                        marcarExtraordinaria(ctx, m.id, !marcar);
                        refrescar();
                      },
                    },
                  });
                } catch (e) {
                  mostrar({ mensaje: mensajeError(e) });
                }
              }}
            />
          ))}
        </View>
      ))}
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

function titulo(m: MovimientoVista): string {
  return m.descripcion ?? m.comercio ?? m.categoria ?? NOMBRE_TIPO_LIBRO[m.tipo] ?? 'Movimiento';
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
  alAnular,
  alExtraordinario,
  alAbrirPersona,
  alAbrirDetalle,
}: {
  m: MovimientoVista;
  abierto: boolean;
  aMeses: boolean;
  alTocar: () => void;
  alAnular: () => void;
  alExtraordinario: () => void;
  alAbrirPersona?: (personaId: string) => void;
  alAbrirDetalle: (transaccionId: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pasando, setPasando] = useState(false);
  const centavos = m.sentido === 'salida' ? -m.monto : m.monto;
  const subtitulo = [m.categoria, ...m.insignias.map((i) => INSIGNIA[i])].filter(Boolean).join(' · ');
  const etiquetaAccesible = etiquetaHablada(
    [titulo(m), subtitulo, formatearCentavos(centavos)].filter(Boolean).join(', '),
  );
  return (
    <Tarjeta
      testID={`movimiento-${m.id}`}
      alPresionar={alTocar}
      accionesAnidadas={abierto}
      expandida={abierto}
      etiquetaAccesible={etiquetaAccesible}
      pista={abierto ? 'Oculta el detalle' : 'Muestra el detalle'}
    >
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
          {aMeses && !pasando && !confirmando ? (
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
          {m.tipo === 'gasto' && !pasando && !confirmando ? (
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
          {pasando ? null : confirmando ? (
            <View style={{ gap: espacio.s }}>
              <Texto variante="cuerpo">¿Anular este movimiento? Sus montos vuelven a tus cuentas.</Texto>
              <Boton etiqueta="Sí, anular" alPresionar={alAnular} testID="boton-confirmar-anular" />
              <Boton etiqueta="Cancelar" variante="texto" alPresionar={() => setConfirmando(false)} />
            </View>
          ) : (
            <Boton
              etiqueta="Anular"
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setConfirmando(true)}
              testID="boton-anular"
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
