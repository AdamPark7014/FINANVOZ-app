import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ResultadoExtraccionPdf } from '../../captura/puente';
import {
  ajustarSaldoConEstado,
  analizarEstadoCuentaPdf,
  etiquetaDiaMes,
  guardarEstadoCuenta,
  type AnalisisEstadoCuenta,
  type LecturaEstadoCuenta,
  type PropuestaConciliacionEstado,
  type RenglonDudoso,
  type RenglonEstado,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, Cifra, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { Casilla, Chips, MensajeError } from '../onboarding/componentes';
import {
  AYUDA_PDF_ESCANEADO,
  BTN_ABRIR,
  BTN_AJUSTAR,
  BTN_CANCELAR,
  BTN_ENTENDIDO,
  BTN_GUARDAR,
  BTN_NO_AJUSTAR,
  BTN_VER_TARJETA,
  CHIP_MISMO,
  CHIP_OTRO,
  ERROR_CONTRASENA_PDF,
  ETIQUETA_CONTRASENA_PDF,
  etiquetaBotonTarjeta,
  etiquetaChipsDudoso,
  mensajeAjustado,
  mensajeAnteriorAlAlta,
  mensajeAnteriores,
  mensajeGuardado,
  mensajeIncompleto,
  mensajeNoReconocido,
  mensajeRenglonesSinLeer,
  mensajeSinTarjetas,
  MENSAJE_CONTRASENA,
  MENSAJE_DEMASIADO_GRANDE,
  MENSAJE_ERROR_GUARDAR,
  MENSAJE_ESCANEADO,
  MENSAJE_FALTAN_DUDOSOS,
  MENSAJE_INVALIDO,
  MENSAJE_LEYENDO,
  MENSAJE_NO_CUADRA,
  MENSAJE_NO_DISPONIBLE,
  NOMBRE_TIPO_RENGLON,
  preguntaConciliacion,
  preguntaElegirTarjeta,
  preguntaMismoMovimiento,
  resumenEstado,
  tituloNuevos,
  TITULO_DUDOSOS,
  TITULO_PANTALLA,
} from './textos';

/** Lee el texto del PDF en el teléfono (el módulo nativo en la app; uno falso en las pruebas). */
export type ExtraerPdf = (contrasena: string | null) => Promise<ResultadoExtraccionPdf>;

type Estado =
  | { tipo: 'leyendo' }
  | { tipo: 'contrasena'; incorrecta: boolean }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'lectura'; paginas: readonly string[]; lectura: LecturaEstadoCuenta }
  | {
      tipo: 'guardado';
      tarjetaId: string;
      nombre: string;
      agregados: number;
      propuesta: PropuestaConciliacionEstado | null;
    }
  | { tipo: 'ajustado'; tarjetaId: string; nombre: string };

/**
 * Estado de cuenta en PDF (`02 §26`, `07 §8`): lee el texto en el teléfono (nada se sube), reconoce el banco y la
 * tarjeta, muestra cuántos movimientos ya tenías, deja revisar los que no y, al guardar, propone la conciliación
 * si el saldo al corte no coincide. Llega por la hoja de compartir o desde el detalle de la tarjeta.
 */
export function LeerEstadoCuenta({
  extraer,
  tarjetaId,
  alVerTarjeta,
  alSalir,
}: {
  extraer: ExtraerPdf;
  /** Desde el detalle de una tarjeta: el estado es de esa tarjeta. */
  tarjetaId?: string | undefined;
  alVerTarjeta: (tarjetaId: string) => void;
  alSalir: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [estado, setEstado] = useState<Estado>({ tipo: 'leyendo' });
  const iniciado = useRef(false);

  const leer = useCallback(
    (contrasena: string | null) => {
      setEstado({ tipo: 'leyendo' });
      extraer(contrasena)
        .then((r) => {
          switch (r.tipo) {
            case 'texto':
              setEstado({
                tipo: 'lectura',
                paginas: r.paginas,
                lectura: analizarEstadoCuentaPdf(ctx, r.paginas, { tarjetaId }),
              });
              return;
            case 'pide_contrasena':
              setEstado({ tipo: 'contrasena', incorrecta: false });
              return;
            case 'contrasena_incorrecta':
              setEstado({ tipo: 'contrasena', incorrecta: true });
              return;
            case 'demasiado_grande':
              setEstado({ tipo: 'error', mensaje: MENSAJE_DEMASIADO_GRANDE });
              return;
            case 'no_disponible':
              setEstado({ tipo: 'error', mensaje: MENSAJE_NO_DISPONIBLE });
              return;
            default:
              setEstado({ tipo: 'error', mensaje: MENSAJE_INVALIDO });
          }
        })
        // Sin detalle: el error podría traer texto del PDF (regla 9).
        .catch(() => setEstado({ tipo: 'error', mensaje: MENSAJE_INVALIDO }));
    },
    [ctx, extraer, tarjetaId],
  );

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    leer(null);
  }, [leer]);

  const elegirTarjeta = (paginas: readonly string[], id: string) =>
    setEstado({
      tipo: 'lectura',
      paginas,
      lectura: analizarEstadoCuentaPdf(ctx, paginas, { tarjetaId: id }),
    });

  return (
    <Pantalla testID="pantalla-estado-cuenta" bordes={['top', 'left', 'right', 'bottom']}>
      <Texto variante="titulo">{TITULO_PANTALLA}</Texto>
      {estado.tipo === 'leyendo' ? (
        <Texto variante="cuerpo" tono="secundario" testID="estado-leyendo" accessibilityLiveRegion="polite">
          {MENSAJE_LEYENDO}
        </Texto>
      ) : null}
      {estado.tipo === 'contrasena' ? (
        <PedirContrasena incorrecta={estado.incorrecta} alAbrir={leer} alSalir={alSalir} />
      ) : null}
      {estado.tipo === 'error' ? (
        <Aviso texto={estado.mensaje} alSalir={alSalir} testID="estado-error" />
      ) : null}
      {estado.tipo === 'lectura' ? (
        <Lectura
          lectura={estado.lectura}
          alElegirTarjeta={(id) => elegirTarjeta(estado.paginas, id)}
          alGuardar={(a, omitir, dudosos) => {
            const r = guardarEstadoCuenta(ctx, estado.paginas, {
              tarjetaId: a.tarjeta.cuentaId,
              omitir,
              dudosos,
            });
            refrescar();
            setEstado({
              tipo: 'guardado',
              tarjetaId: a.tarjeta.cuentaId,
              nombre: a.tarjeta.nombre,
              agregados: r.agregados,
              propuesta: r.conciliacion,
            });
          }}
          alSalir={alSalir}
        />
      ) : null}
      {estado.tipo === 'guardado' ? (
        <Guardado
          agregados={estado.agregados}
          nombre={estado.nombre}
          propuesta={estado.propuesta}
          alAjustar={(p) => {
            ajustarSaldoConEstado(ctx, p);
            refrescar();
            setEstado({ tipo: 'ajustado', tarjetaId: estado.tarjetaId, nombre: estado.nombre });
          }}
          alNoAjustar={() => setEstado({ ...estado, propuesta: null })}
          alVerTarjeta={() => alVerTarjeta(estado.tarjetaId)}
        />
      ) : null}
      {estado.tipo === 'ajustado' ? (
        <>
          <Texto variante="cuerpo" testID="estado-ajustado" accessibilityLiveRegion="polite">
            {mensajeAjustado(estado.nombre)}
          </Texto>
          <Boton
            etiqueta={BTN_VER_TARJETA}
            alPresionar={() => alVerTarjeta(estado.tarjetaId)}
            testID="estado-ver-tarjeta"
          />
        </>
      ) : null}
    </Pantalla>
  );
}

function Aviso({ texto, alSalir, testID }: { texto: string; alSalir: () => void; testID: string }) {
  return (
    <>
      <Texto variante="cuerpo" testID={testID} accessibilityLiveRegion="polite">
        {texto}
      </Texto>
      <Boton etiqueta={BTN_ENTENDIDO} variante="secundario" alPresionar={alSalir} testID="estado-salir" />
    </>
  );
}

function PedirContrasena({
  incorrecta,
  alAbrir,
  alSalir,
}: {
  incorrecta: boolean;
  alAbrir: (contrasena: string) => void;
  alSalir: () => void;
}) {
  const [contrasena, setContrasena] = useState('');
  const abrir = () => {
    if (contrasena !== '') alAbrir(contrasena);
  };
  return (
    <>
      <Texto variante="cuerpo">{MENSAJE_CONTRASENA}</Texto>
      <CampoTexto
        etiqueta={ETIQUETA_CONTRASENA_PDF}
        valor={contrasena}
        alCambiar={setContrasena}
        alEnviar={abrir}
        error={incorrecta ? ERROR_CONTRASENA_PDF : null}
        nativo={{ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false }}
        testID="estado-contrasena"
      />
      <Boton etiqueta={BTN_ABRIR} alPresionar={abrir} deshabilitado={contrasena === ''} testID="estado-abrir" />
      <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alSalir} testID="estado-cancelar" />
    </>
  );
}

function Lectura({
  lectura,
  alElegirTarjeta,
  alGuardar,
  alSalir,
}: {
  lectura: LecturaEstadoCuenta;
  alElegirTarjeta: (tarjetaId: string) => void;
  alGuardar: (a: AnalisisEstadoCuenta, omitir: number[], dudosos: Record<number, 'mismo' | 'otro'>) => void;
  alSalir: () => void;
}) {
  switch (lectura.tipo) {
    case 'escaneado':
      return (
        <>
          <Texto variante="subtitulo" testID="estado-escaneado" accessibilityLiveRegion="polite">
            {MENSAJE_ESCANEADO}
          </Texto>
          <Aviso texto={AYUDA_PDF_ESCANEADO} alSalir={alSalir} testID="estado-escaneado-ayuda" />
        </>
      );
    case 'no_reconocido':
      return (
        <Aviso texto={mensajeNoReconocido(lectura.bancos)} alSalir={alSalir} testID="estado-no-reconocido" />
      );
    case 'incompleto':
      return (
        <Aviso texto={mensajeIncompleto(lectura.banco)} alSalir={alSalir} testID="estado-incompleto" />
      );
    case 'sin_tarjetas':
      return (
        <Aviso texto={mensajeSinTarjetas(lectura.banco)} alSalir={alSalir} testID="estado-sin-tarjetas" />
      );
    case 'anterior_al_alta':
      return (
        <Aviso
          texto={mensajeAnteriorAlAlta(lectura.corte, lectura.tarjeta.nombre)}
          alSalir={alSalir}
          testID="estado-anterior"
        />
      );
    case 'elegir_tarjeta':
      return (
        <>
          <Texto variante="cuerpo" testID="estado-elegir" accessibilityLiveRegion="polite">
            {preguntaElegirTarjeta(lectura.banco, lectura.ultimos4, lectura.corte)}
          </Texto>
          {lectura.tarjetas.map((t) => (
            <Boton
              key={t.cuentaId}
              etiqueta={etiquetaBotonTarjeta(t.nombre, t.ultimos4)}
              variante="secundario"
              alPresionar={() => alElegirTarjeta(t.cuentaId)}
              testID={`estado-tarjeta-${t.cuentaId}`}
            />
          ))}
          <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alSalir} testID="estado-cancelar" />
        </>
      );
    case 'listo':
      return <Revisar a={lectura.analisis} alGuardar={alGuardar} alSalir={alSalir} />;
  }
}

function etiquetaRenglon(r: RenglonEstado): string {
  return `${NOMBRE_TIPO_RENGLON[r.tipo]}: ${r.descripcion} · ${etiquetaDiaMes(r.fecha)} · ${formatearCentavos(r.monto)}`;
}

function Revisar({
  a,
  alGuardar,
  alSalir,
}: {
  a: AnalisisEstadoCuenta;
  alGuardar: (a: AnalisisEstadoCuenta, omitir: number[], dudosos: Record<number, 'mismo' | 'otro'>) => void;
  alSalir: () => void;
}) {
  const [quitados, setQuitados] = useState<ReadonlySet<number>>(new Set());
  const [respuestas, setRespuestas] = useState<Readonly<Record<number, 'mismo' | 'otro'>>>({});
  const [error, setError] = useState<string | null>(null);
  const faltan = a.dudosos.some((d) => respuestas[d.indice] === undefined);
  const guardar = () => {
    try {
      alGuardar(a, [...quitados], { ...respuestas });
    } catch {
      setError(MENSAJE_ERROR_GUARDAR);
    }
  };
  return (
    <>
      <Tarjeta testID="estado-resumen">
        <Texto variante="cuerpo" testID="estado-resumen-texto" accessibilityLiveRegion="polite">
          {resumenEstado(a)}
        </Texto>
        {a.cuadra === false ? (
          <Texto variante="secundario" tono="faltante" testID="estado-no-cuadra">
            {MENSAJE_NO_CUADRA}
          </Texto>
        ) : null}
        {a.renglonesSinLeer > 0 ? (
          <Texto variante="secundario" tono="faltante" testID="estado-sin-leer">
            {mensajeRenglonesSinLeer(a.renglonesSinLeer)}
          </Texto>
        ) : null}
        {a.anteriores > 0 ? (
          <Texto variante="secundario" tono="secundario">
            {mensajeAnteriores(a.anteriores)}
          </Texto>
        ) : null}
      </Tarjeta>

      {a.nuevos.length > 0 ? (
        <View style={{ gap: espacio.xs }} testID="estado-nuevos">
          <Texto variante="subtitulo">{a.nuevos.length === 1 ? 'El que no tenía' : 'Los que no tenía'}</Texto>
          {a.nuevos.map((n) => (
            <Casilla
              key={n.indice}
              etiqueta={etiquetaRenglon(n)}
              valor={!quitados.has(n.indice)}
              alCambiar={(v) =>
                setQuitados((q) => {
                  const s = new Set(q);
                  if (v) s.delete(n.indice);
                  else s.add(n.indice);
                  return s;
                })
              }
              testID={`estado-nuevo-${n.indice}`}
            />
          ))}
        </View>
      ) : null}

      {a.dudosos.length > 0 ? (
        <View style={{ gap: espacio.m }} testID="estado-dudosos">
          <Texto variante="subtitulo" accessibilityRole="header">
            {TITULO_DUDOSOS}
          </Texto>
          {a.dudosos.map((d) => (
            <Dudoso
              key={d.indice}
              d={d}
              valor={respuestas[d.indice] ?? null}
              alCambiar={(v) => setRespuestas((r) => ({ ...r, [d.indice]: v }))}
            />
          ))}
        </View>
      ) : null}

      <MensajeError texto={error} />
      <Boton etiqueta={BTN_GUARDAR} alPresionar={guardar} deshabilitado={faltan} testID="estado-guardar" />
      {faltan ? (
        <Texto variante="secundario" tono="secundario">
          {MENSAJE_FALTAN_DUDOSOS}
        </Texto>
      ) : null}
      <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alSalir} testID="estado-cancelar" />
    </>
  );
}

function Dudoso({
  d,
  valor,
  alCambiar,
}: {
  d: RenglonDudoso;
  valor: 'mismo' | 'otro' | null;
  alCambiar: (v: 'mismo' | 'otro') => void;
}) {
  return (
    <Tarjeta testID={`estado-dudoso-${d.indice}`} accionesAnidadas>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="cuerpo" style={{ flex: 1 }}>
          {`${d.descripcion} · ${etiquetaDiaMes(d.fecha)}`}
        </Texto>
        <Cifra centavos={d.monto} tamano="secundario" contexto={d.descripcion} />
      </View>
      <Texto variante="secundario" tono="secundario">
        {preguntaMismoMovimiento(d.existente.descripcion, d.existente.fecha, d.existente.monto)}
      </Texto>
      <Chips
        etiqueta={etiquetaChipsDudoso(d.descripcion)}
        opciones={[
          { valor: 'mismo', etiqueta: CHIP_MISMO },
          { valor: 'otro', etiqueta: CHIP_OTRO },
        ]}
        valor={valor}
        alCambiar={alCambiar}
        testID={`estado-dudoso-${d.indice}`}
      />
    </Tarjeta>
  );
}

function Guardado({
  agregados,
  nombre,
  propuesta,
  alAjustar,
  alNoAjustar,
  alVerTarjeta,
}: {
  agregados: number;
  nombre: string;
  propuesta: PropuestaConciliacionEstado | null;
  alAjustar: (p: PropuestaConciliacionEstado) => void;
  alNoAjustar: () => void;
  alVerTarjeta: () => void;
}) {
  return (
    <>
      <Texto variante="cuerpo" testID="estado-guardado" accessibilityLiveRegion="polite">
        {mensajeGuardado(agregados, nombre)}
      </Texto>
      {propuesta ? (
        <Tarjeta testID="estado-conciliacion" accionesAnidadas>
          <Texto variante="cuerpo" testID="estado-conciliacion-texto" accessibilityLiveRegion="polite">
            {preguntaConciliacion(propuesta)}
          </Texto>
          <Boton etiqueta={BTN_AJUSTAR} alPresionar={() => alAjustar(propuesta)} testID="estado-ajustar" />
          <Boton
            etiqueta={BTN_NO_AJUSTAR}
            variante="secundario"
            alPresionar={alNoAjustar}
            testID="estado-no-ajustar"
          />
        </Tarjeta>
      ) : (
        <Boton etiqueta={BTN_VER_TARJETA} alPresionar={alVerTarjeta} testID="estado-ver-tarjeta" />
      )}
    </>
  );
}
a" />
      )}
    </>
  );
}
