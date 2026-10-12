import type { Centavos } from '@cartera/core';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  agregarCuentaDesdeCaptura,
  asociarCuentaCaptura,
  confirmarCaptura,
  crearPersona,
  descartarCaptura,
  etiquetaFecha,
  fueAMeses,
  listarCategorias,
  listarCuentas,
  listarPersonas,
  responderDuplicado,
  responderPagoSinOrigen,
  responderSalidaSinPareja,
  type PreguntaCaptura,
  type RespuestaPago,
  type RespuestaSalida,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from '../principal/Chip';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { useFormularioTarjeta } from '../tarjetas/FormularioTarjetaNueva';
import { mensajeCompraMsi } from '../tarjetas/textos';

type Pregunta<T extends PreguntaCaptura['tipo']> = Extract<PreguntaCaptura, { tipo: T }>;

/** Meses comunes de "¿Fue a meses?" (`02 §6`). */
export const MESES_CAPTURA = ['3', '6', '9', '12', '18', '24'] as const;

/** Las preguntas de captura de Hoy (`02 §6`, prioridad 5 de `02 §4.1`). */
export function TarjetaPreguntaCaptura({ pregunta, testID }: { pregunta: PreguntaCaptura; testID: string }) {
  switch (pregunta.tipo) {
    case 'salida_sin_pareja':
      return <SalidaSinPareja p={pregunta} testID={testID} />;
    case 'pago_sin_origen':
      return <PagoSinOrigen p={pregunta} testID={testID} />;
    case 'cuenta_nueva':
      return <CuentaNueva p={pregunta} testID={testID} />;
    case 'duplicado':
      return <Duplicado p={pregunta} testID={testID} />;
    case 'fue_a_meses':
      return <FueAMeses p={pregunta} testID={testID} />;
  }
}

/** Ejecuta una respuesta: refresca, avisa y, si falla, muestra el mensaje general (nunca el detalle). */
function useResponder() {
  const { refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const [error, setError] = useState<string | null>(null);
  const responder = (accion: () => void, mensaje: string) => {
    setError(null);
    try {
      accion();
      refrescar();
      mostrar({ mensaje });
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  return { responder, error };
}

function Fallo({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <Texto variante="secundario" tono="faltante">
      {texto}
    </Texto>
  );
}

function Marco({
  testID,
  titulo,
  detalle,
  error,
  children,
}: {
  testID: string;
  titulo: string;
  detalle: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{titulo}</Texto>
      <Texto variante="secundario" tono="secundario">
        {detalle}
      </Texto>
      <View style={{ gap: espacio.s }}>{children}</View>
      <Fallo texto={error} />
    </Tarjeta>
  );
}

/** Cuentas propias (débito, efectivo, tarjetas) para "A otra cuenta mía" y "De una de mis cuentas". */
function useCuentasPropias(excluir: string) {
  const { ctx } = useSesion();
  const [cuentas] = useState(() => {
    const v = listarCuentas(ctx);
    return [
      ...v.tienes.map((c) => ({ id: c.id, nombre: c.nombre })),
      ...v.debes.filter((d) => d.tipo === 'tarjeta').map((d) => ({ id: d.id, nombre: d.nombre })),
    ].filter((c) => c.nombre !== excluir);
  });
  return cuentas;
}

/** "¿A quién?": personas ya registradas o una nueva por nombre. */
function ElegirPersona({
  testID,
  pregunta,
  alElegir,
}: {
  testID: string;
  pregunta: string;
  alElegir: (personaId: string) => void;
}) {
  const { ctx } = useSesion();
  const [personas] = useState(() => listarPersonas(ctx));
  const [nombre, setNombre] = useState('');
  return (
    <View style={{ gap: espacio.s }}>
      <Texto variante="secundario">{pregunta}</Texto>
      {personas.length > 0 ? (
        <GrupoChips
          opciones={personas.map((p) => ({ valor: p.cuentaId, etiqueta: p.nombre }))}
          valor={null}
          alCambiar={alElegir}
          prefijoTestID={`${testID}-persona`}
        />
      ) : null}
      <CampoTexto
        etiqueta="Otra persona"
        valor={nombre}
        alCambiar={setNombre}
        ejemplo="Juan"
        testID={`${testID}-nombre`}
      />
      <Boton
        etiqueta="Guardar"
        variante="secundario"
        deshabilitado={nombre.trim() === ''}
        alPresionar={() => {
          let personaId: string;
          try {
            personaId = crearPersona(ctx, { nombre });
          } catch {
            return;
          }
          alElegir(personaId);
        }}
        testID={`${testID}-guardar-persona`}
      />
    </View>
  );
}

type OpcionSalida = 'cuenta' | 'prestamo' | 'gasto' | 'otro';

/** "¿A quién le mandaste $300?" (E9.4 después de 24 h, caso 18, CA-M5-09). */
function SalidaSinPareja({ p, testID }: { p: Pregunta<'salida_sin_pareja'>; testID: string }) {
  const { ctx } = useSesion();
  const { responder, error } = useResponder();
  const [opcion, setOpcion] = useState<OpcionSalida | null>(null);
  const cuentas = useCuentasPropias(p.cuenta);
  const [categorias] = useState(() => listarCategorias(ctx, 'gasto'));
  const contestar = (r: RespuestaSalida, mensaje: string) =>
    responder(() => responderSalidaSinPareja(ctx, p.capturaId, r), mensaje);
  return (
    <Marco
      testID={testID}
      titulo={`¿A quién le mandaste ${formatearCentavos(p.monto)}?`}
      detalle={`Salió de ${p.cuenta} el ${etiquetaFecha(p.fecha)} y no vi a dónde llegó.`}
      error={error}
    >
      <GrupoChips
        opciones={[
          { valor: 'cuenta', etiqueta: 'A otra cuenta mía' },
          { valor: 'prestamo', etiqueta: 'Le presté' },
          { valor: 'gasto', etiqueta: 'Pagué algo' },
          { valor: 'otro', etiqueta: 'Otro' },
        ]}
        valor={opcion}
        alCambiar={(o) => {
          if (o === 'otro') contestar({ destino: 'otro' }, 'Va. Lo dejo en Por revisar.');
          else setOpcion(o);
        }}
        prefijoTestID={testID}
      />
      {opcion === 'cuenta' ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario">¿A cuál?</Texto>
          <GrupoChips
            opciones={[
              ...p.entradas.map((e) => ({
                valor: `e:${e.capturaId}`,
                etiqueta: `${e.cuenta} · ${etiquetaFecha(e.fecha)}`,
              })),
              ...cuentas.map((c) => ({ valor: `c:${c.id}`, etiqueta: c.nombre })),
              { valor: 'externa', etiqueta: 'Una que no llevo aquí' },
            ]}
            valor={null}
            alCambiar={(v) => {
              const r: RespuestaSalida =
                v === 'externa'
                  ? { destino: 'externa' }
                  : v.startsWith('e:')
                    ? { destino: 'entrada', capturaId: v.slice(2) }
                    : { destino: 'cuenta', cuentaId: v.slice(2) };
              contestar(r, 'Listo: lo cuento como un movimiento entre tus cuentas.');
            }}
            prefijoTestID={`${testID}-destino`}
          />
        </View>
      ) : null}
      {opcion === 'prestamo' ? (
        <ElegirPersona
          testID={testID}
          pregunta="¿A quién le prestaste?"
          alElegir={(personaId) =>
            contestar({ destino: 'prestamo', personaId }, 'Listo: lo anoté como un préstamo.')
          }
        />
      ) : null}
      {opcion === 'gasto' ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario">¿Qué pagaste?</Texto>
          <GrupoChips
            opciones={categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }))}
            valor={null}
            alCambiar={(categoria) =>
              contestar({ destino: 'gasto', categoria }, 'Listo: lo anoté como un gasto.')
            }
            prefijoTestID={`${testID}-categoria`}
          />
        </View>
      ) : null}
    </Marco>
  );
}

type OpcionPago = 'cuenta' | 'externa' | 'alguien';

/** "¿De dónde salió el pago de $4,200 a tu Oro?" (caso 19). */
function PagoSinOrigen({ p, testID }: { p: Pregunta<'pago_sin_origen'>; testID: string }) {
  const { ctx } = useSesion();
  const { responder, error } = useResponder();
  const [opcion, setOpcion] = useState<OpcionPago | null>(null);
  const [debe, setDebe] = useState<'si' | 'no' | null>(null);
  const cuentas = useCuentasPropias(p.tarjeta);
  const contestar = (r: RespuestaPago, mensaje: string) =>
    responder(() => responderPagoSinOrigen(ctx, p.capturaId, r), mensaje);
  return (
    <Marco
      testID={testID}
      titulo={`¿De dónde salió el pago de ${formatearCentavos(p.monto)} a tu ${p.tarjeta}?`}
      detalle={`Llegó el ${etiquetaFecha(p.fecha)} y no vi de qué cuenta salió.`}
      error={error}
    >
      <GrupoChips
        opciones={[
          { valor: 'cuenta', etiqueta: 'De una de mis cuentas' },
          { valor: 'externa', etiqueta: 'De una cuenta que no llevo aquí' },
          { valor: 'alguien', etiqueta: 'Alguien más la pagó' },
        ]}
        valor={opcion}
        alCambiar={(o) => {
          if (o === 'externa') contestar({ origen: 'externa' }, 'Listo: registré el pago de tu tarjeta.');
          else setOpcion(o);
        }}
        prefijoTestID={testID}
      />
      {opcion === 'cuenta' ? (
        <GrupoChips
          opciones={[
            ...p.salidas.map((s) => ({
              valor: `s:${s.capturaId}`,
              etiqueta: `${s.cuenta} · ${etiquetaFecha(s.fecha)}`,
            })),
            ...cuentas.map((c) => ({ valor: `c:${c.id}`, etiqueta: c.nombre })),
          ]}
          valor={null}
          alCambiar={(v) =>
            contestar(
              v.startsWith('s:')
                ? { origen: 'salida', capturaId: v.slice(2) }
                : { origen: 'cuenta', cuentaId: v.slice(2) },
              'Listo: registré el pago de tu tarjeta.',
            )
          }
          prefijoTestID={`${testID}-origen`}
        />
      ) : null}
      {opcion === 'alguien' ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario">¿Se lo tienes que pagar?</Texto>
          <GrupoChips
            opciones={[
              { valor: 'si', etiqueta: 'Sí, se lo debo' },
              { valor: 'no', etiqueta: 'No, me lo regalaron' },
            ]}
            valor={debe}
            alCambiar={(v) => {
              if (v === 'no') contestar({ origen: 'regalo' }, 'Listo: lo anoté como un regalo.');
              else setDebe(v);
            }}
            prefijoTestID={`${testID}-debe`}
          />
          {debe === 'si' ? (
            <ElegirPersona
              testID={testID}
              pregunta="¿Quién la pagó?"
              alElegir={(personaId) =>
                contestar({ origen: 'persona', personaId }, 'Listo: anoté que se lo debes.')
              }
            />
          ) : null}
        </View>
      ) : null}
    </Marco>
  );
}

/**
 * "Detecté una tarjeta ••4321 de Banco A. ¿La agrego?" (`02 §6`): mini formulario con el saldo obligatorio
 * (`02 §3.1`); si ya la tienes, elegirla le enseña su banco. Sin últimos 4: "¿En qué cuenta fue?".
 */
function CuentaNueva({ p, testID }: { p: Pregunta<'cuenta_nueva'>; testID: string }) {
  const { ctx } = useSesion();
  const { responder, error } = useResponder();
  const [agregando, setAgregando] = useState(false);
  const que = p.sugerencia === 'tarjeta_credito' ? 'una tarjeta' : 'una cuenta';
  const titulo = p.ultimos4
    ? `Detecté ${que} ••${p.ultimos4} de ${p.banco}. ¿La agrego?`
    : `Llegó un aviso de ${p.banco}. ¿En qué cuenta fue?`;
  const asociar = (cuentaId: string) =>
    responder(() => asociarCuentaCaptura(ctx, p.capturaId, cuentaId), 'Listo: ya sé de qué cuenta es.');
  return (
    <Marco
      testID={testID}
      titulo={titulo}
      detalle={`${formatearCentavos(p.monto)} · ${etiquetaFecha(p.fecha)}`}
      error={error}
    >
      {agregando ? (
        p.sugerencia === 'tarjeta_credito' ? (
          <FormularioTarjetaCaptura
            testID={`${testID}-form`}
            alias={p.banco}
            alGuardar={asociar}
            alCancelar={() => setAgregando(false)}
          />
        ) : (
          <FormularioCuentaCaptura
            testID={`${testID}-form`}
            p={p}
            alGuardar={() => responder(() => {}, 'Listo: agregué la cuenta.')}
            alCancelar={() => setAgregando(false)}
          />
        )
      ) : (
        <>
          {p.candidatas.length > 0 ? (
            <View style={{ gap: espacio.xs }}>
              <Texto variante="secundario">¿Es alguna de estas?</Texto>
              <GrupoChips
                opciones={p.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
                valor={null}
                alCambiar={asociar}
                prefijoTestID={`${testID}-cuenta`}
              />
            </View>
          ) : null}
          <Boton
            etiqueta={p.ultimos4 ? 'Sí, agrégala' : 'Agregar la cuenta'}
            alPresionar={() => setAgregando(true)}
            testID={`${testID}-agregar`}
          />
          <Boton
            etiqueta="No es mía"
            variante="texto"
            alPresionar={() =>
              responder(() => descartarCaptura(ctx, p.capturaId), 'Va. No registré ese movimiento.')
            }
            testID={`${testID}-no-es-mia`}
          />
        </>
      )}
    </Marco>
  );
}

function FormularioTarjetaCaptura({
  testID,
  alias,
  alGuardar,
  alCancelar,
}: {
  testID: string;
  alias: string;
  alGuardar: (cuentaId: string) => void;
  alCancelar: () => void;
}) {
  const { campos, guardar } = useFormularioTarjeta({
    prellenado: { alias, diaCorte: null, diaLimitePago: null, diasParaPagar: null },
    alGuardar: (t) => alGuardar(t.cuentaId),
  });
  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      {campos}
      <Boton etiqueta="Guardar tarjeta" alPresionar={guardar} testID={`${testID}-guardar`} />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} />
    </View>
  );
}

/** Débito o ahorro detectado: nombre y saldo (obligatorio, `02 §3.1`). */
function FormularioCuentaCaptura({
  testID,
  p,
  alGuardar,
  alCancelar,
}: {
  testID: string;
  p: Pregunta<'cuenta_nueva'>;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const [nombre, setNombre] = useState(p.banco);
  const [saldo, setSaldo] = useState<Centavos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guardar = () => {
    if (nombre.trim() === '') return setError('Ponle un nombre a la cuenta.');
    if (saldo === null) return setError('Escribe cuánto tiene la cuenta hoy.');
    try {
      agregarCuentaDesdeCaptura(ctx, p.capturaId, { nombre: nombre.trim(), saldoHoy: saldo });
      alGuardar();
    } catch {
      setError('No pude guardar eso. Revisa los datos e intenta de nuevo.');
    }
  };
  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      <CampoTexto etiqueta="Nombre" valor={nombre} alCambiar={setNombre} testID={`${testID}-nombre`} />
      <CampoMonto
        etiqueta="¿Cuánto tiene hoy?"
        ayuda="El saldo que ves hoy en tu app; ya incluye este movimiento."
        alCambiar={setSaldo}
        testID={`${testID}-saldo`}
      />
      <Fallo texto={error} />
      <Boton etiqueta="Guardar cuenta" alPresionar={guardar} testID={`${testID}-guardar`} />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} />
    </View>
  );
}

/** E9.3 `preguntar`: "¿Es lo mismo que «Coca» del vie 9?". */
function Duplicado({ p, testID }: { p: Pregunta<'duplicado'>; testID: string }) {
  const { ctx } = useSesion();
  const { responder, error } = useResponder();
  const que = p.dictado.descripcion ? `«${p.dictado.descripcion}»` : 'lo que anotaste';
  return (
    <Marco
      testID={testID}
      titulo={`¿Es lo mismo que ${que} del ${etiquetaFecha(p.dictado.fecha)}?`}
      detalle={`Tu banco avisó de ${formatearCentavos(p.monto)} el ${etiquetaFecha(p.fecha)}; anotaste ${formatearCentavos(p.dictado.monto)}.`}
      error={error}
    >
      <Boton
        etiqueta="Sí, es el mismo"
        alPresionar={() =>
          responder(() => responderDuplicado(ctx, p.capturaId, 'mismo'), 'Listo: lo dejé una sola vez.')
        }
        testID={`${testID}-mismo`}
      />
      <Boton
        etiqueta="No, es otro"
        variante="secundario"
        alPresionar={() =>
          responder(() => responderDuplicado(ctx, p.capturaId, 'otro'), 'Listo: lo registré aparte.')
        }
        testID={`${testID}-otro`}
      />
    </Marco>
  );
}

/** RF-CAP-08: "¿Fue a meses?" con los meses comunes y "No". */
function FueAMeses({ p, testID }: { p: Pregunta<'fue_a_meses'>; testID: string }) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const { responder, error } = useResponder();
  const [errorMeses, setErrorMeses] = useState<string | null>(null);
  const que = p.comercio ? `${p.comercio} ` : '';
  return (
    <Marco
      testID={testID}
      titulo="¿Fue a meses?"
      detalle={`${que}${formatearCentavos(p.monto)} con tu ${p.tarjeta} · ${etiquetaFecha(p.fecha)}`}
      error={error ?? errorMeses}
    >
      <GrupoChips
        opciones={[
          ...MESES_CAPTURA.map((n) => ({ valor: n as string, etiqueta: `${n} meses` })),
          { valor: 'no', etiqueta: 'No' },
        ]}
        valor={null}
        alCambiar={(v) => {
          if (v === 'no') {
            responder(() => confirmarCaptura(ctx, p.capturaId), 'Va. Lo dejo como cargo normal.');
            return;
          }
          try {
            const r = fueAMeses(ctx, p.capturaId, Number(v));
            avisarRegistro(mensajeCompraMsi(r), r.deshacer);
          } catch (e) {
            setErrorMeses(mensajeError(e));
          }
        }}
        prefijoTestID={`${testID}-meses`}
      />
    </Marco>
  );
}
