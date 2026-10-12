import { useState } from 'react';
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
  pasarAMeses,
  type MovimientoVista,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, Cifra, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { PorRevisarCapturas } from '../captura/PorRevisarCapturas';
import { leerEntero } from '../onboarding/ingreso';
import { mensajeCompraMsi } from '../tarjetas/textos';
import { GrupoChips } from './Chip';
import { useMostrarAviso } from './ProveedorAvisos';
import { useAvisoRegistro } from './useAvisoRegistro';
import { MENSAJE_ERROR_GENERAL, NOMBRE_ORIGEN, NOMBRE_TIPO_LIBRO, resumenMovimiento } from './textos';

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
}: {
  alRegistrar: () => void;
  /** Abre Registrar con una frase que la nube ya entendió pero necesita confirmación. */
  alRevisar?: (fraseId: string) => void;
}) {
  const dias = useVista((ctx) => listarMovimientos(ctx));
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
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const [abierto, setAbierto] = useState<string | null>(null);

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
          <Texto variante="subtitulo">Por revisar</Texto>
          <Texto variante="secundario" tono="secundario">
            Las interpreto cuando tengas internet. Si ya lo registraste a mano, descártala.
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

      {dias.length === 0 ? (
        <Texto variante="cuerpo" tono="secundario" testID="movimientos-vacio">
          Todavía no registras movimientos. En Hoy di o escribe algo como «tacos 80 en efectivo».
        </Texto>
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
              alTocar={() => setAbierto((a) => (a === m.id ? null : m.id))}
              alAnular={() => {
                try {
                  anularMovimiento(ctx, m.id);
                  setAbierto(null);
                  refrescar();
                  mostrar({ mensaje: 'Anulé el movimiento.' });
                } catch {
                  mostrar({ mensaje: MENSAJE_ERROR_GENERAL });
                }
              }}
              alExtraordinario={() => {
                // "Fue algo extraordinario" (`04 §3`, `05 §E8.2`): no cuenta para estimar si llegas.
                try {
                  marcarExtraordinaria(ctx, m.id, true);
                  refrescar();
                  mostrar({
                    mensaje: 'Listo: no lo uso para estimar tus gastos de cada día.',
                    accion: {
                      etiqueta: 'Deshacer',
                      alPresionar: () => {
                        marcarExtraordinaria(ctx, m.id, false);
                        refrescar();
                      },
                    },
                  });
                } catch {
                  mostrar({ mensaje: MENSAJE_ERROR_GENERAL });
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
function PasarAMeses({ m, alTerminar }: { m: MovimientoVista; alTerminar: () => void }) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const [meses, setMeses] = useState<string | null>(null);
  const [otro, setOtro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const guardar = () => {
    const n = meses !== null ? Number(meses) : leerEntero(otro, 2, 48);
    if (n === null) return setError('Elige los meses, de 2 a 48.');
    try {
      const r = pasarAMeses(ctx, m.id, n);
      avisarRegistro(mensajeCompraMsi(r), r.deshacer);
      alTerminar();
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };
  return (
    <View style={{ gap: espacio.s }} testID={`pasar-a-meses-${m.id}`}>
      <Texto variante="cuerpo">¿A cuántos meses sin intereses fue?</Texto>
      <GrupoChips
        opciones={MESES_COMUNES.map((n) => ({ valor: n, etiqueta: `${n} meses` }))}
        valor={meses}
        alCambiar={(n) => {
          setMeses(n);
          setOtro('');
        }}
        prefijoTestID="meses"
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
}: {
  m: MovimientoVista;
  abierto: boolean;
  aMeses: boolean;
  alTocar: () => void;
  alAnular: () => void;
  alExtraordinario: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pasando, setPasando] = useState(false);
  const centavos = m.sentido === 'salida' ? -m.monto : m.monto;
  const subtitulo = [m.categoria, ...m.insignias.map((i) => INSIGNIA[i])].filter(Boolean).join(' · ');
  return (
    <Tarjeta
      testID={`movimiento-${m.id}`}
      alPresionar={alTocar}
      etiquetaAccesible={`${titulo(m)}, ${subtitulo}`}
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
          {m.categoria ? <Texto variante="secundario">{`Categoría: ${m.categoria}`}</Texto> : null}
          {m.reemplazaA ? <Historial id={m.id} /> : null}
          <Texto variante="secundario" tono="secundario">
            {`${NOMBRE_ORIGEN[m.origen] ?? 'Registrado'} · ${etiquetaDiaMes(m.fecha)}`}
          </Texto>
          {pasando ? <PasarAMeses m={m} alTerminar={() => setPasando(false)} /> : null}
          {aMeses && !pasando && !confirmando ? (
            <Boton
              etiqueta="Pasar a meses"
              variante="secundario"
              ancho="contenido"
              alPresionar={() => setPasando(true)}
              testID="boton-pasar-a-meses"
            />
          ) : null}
          {m.tipo === 'gasto' && !pasando && !confirmando ? (
            <Boton
              etiqueta="Fue algo extraordinario"
              variante="texto"
              ancho="contenido"
              pista="No lo uso para estimar si llegas a tu próximo ingreso"
              alPresionar={alExtraordinario}
              testID="boton-extraordinario"
            />
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
