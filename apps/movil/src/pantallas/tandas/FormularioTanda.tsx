import {
  conDia,
  diasDelMes,
  esFecha,
  partes,
  type Centavos,
  type PlainDate,
  type Regla,
} from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  crearTanda,
  etiquetaDiaMes,
  etiquetaFecha,
  listarCuentas,
  proponerTanda,
  reglaDeFrecuencia,
  type EntradaTanda,
  type FrecuenciaTanda,
  type PropuestaTanda,
  type TandaCreada,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, Tarjeta, Texto } from '../../ui';
import { useAnunciarEnIos } from '../avisos/anunciar';
import { Chips, MensajeError } from '../onboarding/componentes';
import { leerEntero } from '../onboarding/ingreso';
import {
  AYUDA_FECHA,
  EJEMPLO_FECHA,
  ETIQUETA_FECHA_HOY,
  MARCA_FECHA_INVALIDA,
  PREGUNTA_FECHAS_CERCANAS,
  EJEMPLO_NOMBRE_TANDA,
  ERROR_APORTACION,
  ERROR_APORTACIONES_HECHAS,
  ERROR_FECHA_INICIO,
  ERROR_FRECUENCIA,
  ERROR_GUARDAR_TANDA,
  ERROR_PARTICIPANTES,
  ETIQUETA_APORTACION,
  ETIQUETA_APORTACIONES_HECHAS,
  ETIQUETA_CANCELAR,
  ETIQUETA_CUENTA_APORTACION_OPCIONAL,
  ETIQUETA_FRECUENCIA,
  ETIQUETA_GUARDAR_TANDA,
  PISTA_CANCELAR_FORMULARIO,
  PISTA_GUARDAR_TANDA,
  ETIQUETA_NOMBRE_OPCIONAL,
  ETIQUETA_PARTICIPANTES,
  ETIQUETA_PRIMERA_FECHA,
  ETIQUETA_TURNO,
  ETIQUETA_YA_TE_TOCO,
  OPCIONES_FRECUENCIA_TANDA,
  OPCIONES_SI_NO,
  TEXTO_COMPROMISO_APORTACION,
  TITULO_YA_EMPEZO,
  errorTurno,
  etiquetaAccesibleResumenCobroFormulario,
  etiquetaAccesibleTextoYaEmpezo,
  textoResumenCobro,
  textoYaEmpezoCompleto,
} from './textos';

type SiNo = 'si' | 'no';

/** "16/10/2026" → `2026-10-16`, o `null`. */
export function leerFecha(texto: string): PlainDate | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const fecha = `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
  return esFecha(fecha) ? fecha : null;
}

/** `2026-10-16` → "16/10/2026". */
export function escribirFecha(fecha: PlainDate): string {
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}`;
}

/**
 * Fechas cercanas para la primera ronda, sin teclear: hoy, el próximo 15 y el último día del mes (las fechas
 * de pago de quincena más comunes). Sin repetir y en orden.
 */
export function fechasCercanas(hoy: PlainDate): PlainDate[] {
  const { anio, mes, dia } = partes(hoy);
  const quince = dia <= 15 ? conDia(anio, mes, 15) : conDia(anio, mes + 1, 15);
  const ultimo = conDia(anio, mes, diasDelMes(anio, mes));
  return [...new Set([hoy, quince, ultimo])].sort();
}

/** "Hoy · 22 oct" o "dom 15 nov". */
function etiquetaFechaCercana(fecha: PlainDate, hoy: PlainDate): string {
  if (fecha === hoy) return `${ETIQUETA_FECHA_HOY} · ${etiquetaDiaMes(fecha)}`;
  const mes = etiquetaDiaMes(fecha).split(' ')[1] ?? '';
  return `${etiquetaFecha(fecha)} ${mes}`.trim();
}

function frecuenciaDe(regla: Regla | undefined): FrecuenciaTanda | null {
  switch (regla?.tipo) {
    case 'semanal':
      return 'semanal';
    case 'quincenal_15_ultimo':
    case 'quincenal_dias':
      return 'quincenal';
    case 'catorcenal':
      return 'catorcenal';
    case 'mensual':
      return 'mensual';
    default:
      return null;
  }
}

/**
 * Formulario de tanda (`02 §18`): nombre, aportación, cada cuándo, participantes, tu turno, primera fecha y de dónde
 * sale. Muestra cuándo cobras; si la primera fecha ya pasó, pregunta "¿Cuántas aportaciones llevas?" y "¿Ya te
 * tocó?" con lo que propone E11. Lo usan Cuentas → Tandas y la frase dictada (TK01, prellenado).
 */
export function FormularioTanda({
  prellenado,
  alGuardar,
  alCancelar,
}: {
  prellenado?: PropuestaTanda | null;
  alGuardar: (t: TandaCreada) => void;
  alCancelar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const cuentas = useVista((c) => listarCuentas(c).tienes.filter((x) => x.subtipo !== 'ahorro'));
  const inicioPrellenado = prellenado ? escribirFecha(prellenado.inicio) : '';
  const frecuenciaPrellenada = frecuenciaDe(prellenado?.regla);
  const [nombre, setNombre] = useState(prellenado?.nombre ?? '');
  const [aportacion, setAportacion] = useState<Centavos | null>(prellenado?.aportacion ?? null);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaTanda | null>(frecuenciaPrellenada);
  const [participantes, setParticipantes] = useState(prellenado ? String(prellenado.participantes) : '');
  const [turno, setTurno] = useState(prellenado ? String(prellenado.turno) : '');
  const [inicio, setInicio] = useState(inicioPrellenado || escribirFecha(ctx.reloj.hoy()));
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [hechas, setHechas] = useState<string | null>(null);
  const [cobro, setCobro] = useState<SiNo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fechaMarcada, setFechaMarcada] = useState(false);
  useAnunciarEnIos(error);
  const hoy = ctx.reloj.hoy();
  const cercanas = fechasCercanas(hoy);
  const fechaEscrita = leerFecha(inicio);

  /** Arma la entrada o dice qué falta (`02 §14`). */
  const armar = (): Omit<EntradaTanda, 'aportacionesHechas' | 'yaCobraste'> | string => {
    if (aportacion === null || aportacion <= 0) return ERROR_APORTACION;
    if (frecuencia === null) return ERROR_FRECUENCIA;
    const n = leerEntero(participantes, 2, 50);
    if (n === null) return ERROR_PARTICIPANTES;
    const k = leerEntero(turno, 1, n);
    if (k === null) return errorTurno(n);
    const fecha = leerFecha(inicio);
    if (fecha === null) return ERROR_FECHA_INICIO;
    const regla =
      prellenado && frecuencia === frecuenciaPrellenada && inicio === inicioPrellenado
        ? prellenado.regla
        : reglaDeFrecuencia(frecuencia, fecha);
    return {
      ...(nombre.trim() !== '' ? { nombre: nombre.trim() } : {}),
      aportacion,
      participantes: n,
      turno: k,
      regla,
      inicio: fecha,
      cuentaId,
    };
  };

  const entrada = armar();
  let propuesta: PropuestaTanda | null = null;
  if (typeof entrada !== 'string') {
    try {
      propuesta = proponerTanda(ctx, entrada);
    } catch {
      propuesta = null;
    }
  }
  const ya = propuesta?.yaEmpezo ?? null;
  const hechasLeidas = hechas === null ? null : leerEntero(hechas, 0, propuesta?.participantes ?? 50);
  // Con la corrección de la persona, lo que queda (E11 en servicios).
  let corregida = ya;
  if (propuesta && ya && typeof entrada !== 'string' && (hechas !== null || cobro !== null)) {
    try {
      corregida =
        proponerTanda(ctx, {
          ...entrada,
          aportacionesHechas: hechasLeidas ?? ya.aportacionesHechas,
          yaCobraste: cobro === null ? ya.yaCobraste : cobro === 'si',
        }).yaEmpezo ?? ya;
    } catch {
      corregida = ya;
    }
  }

  const guardar = () => {
    if (typeof entrada === 'string') {
      setError(entrada);
      setFechaMarcada(entrada === ERROR_FECHA_INICIO);
      return;
    }
    if (hechas !== null && hechasLeidas === null) {
      setError(ERROR_APORTACIONES_HECHAS);
      return;
    }
    let creada: TandaCreada;
    try {
      creada = crearTanda(ctx, {
        ...entrada,
        ...(ya && corregida
          ? { aportacionesHechas: corregida.aportacionesHechas, yaCobraste: corregida.yaCobraste }
          : {}),
      });
    } catch {
      setError(ERROR_GUARDAR_TANDA);
      return;
    }
    refrescar();
    alGuardar(creada);
  };

  return (
    <View style={{ gap: espacio.m }} testID="formulario-tanda">
      <CampoTexto
        testID="tanda-nombre"
        etiqueta={ETIQUETA_NOMBRE_OPCIONAL}
        ejemplo={EJEMPLO_NOMBRE_TANDA}
        valor={nombre}
        alCambiar={setNombre}
      />
      <CampoMonto
        testID="tanda-aportacion"
        etiqueta={ETIQUETA_APORTACION}
        valorInicial={prellenado?.aportacion ?? null}
        alCambiar={setAportacion}
      />
      <Chips
        testID="tanda-frecuencia"
        etiqueta={ETIQUETA_FRECUENCIA}
        opciones={OPCIONES_FRECUENCIA_TANDA}
        valor={frecuencia}
        alCambiar={setFrecuencia}
      />
      <CampoTexto
        testID="tanda-participantes"
        etiqueta={ETIQUETA_PARTICIPANTES}
        ejemplo="10"
        teclado="number-pad"
        valor={participantes}
        alCambiar={setParticipantes}
      />
      <CampoTexto
        testID="tanda-turno"
        etiqueta={ETIQUETA_TURNO}
        ejemplo="4"
        teclado="number-pad"
        valor={turno}
        alCambiar={setTurno}
      />
      <Chips
        testID="tanda-fecha"
        etiqueta={PREGUNTA_FECHAS_CERCANAS}
        opciones={cercanas.map((f) => ({ valor: f, etiqueta: etiquetaFechaCercana(f, hoy) }))}
        valor={fechaEscrita !== null && cercanas.includes(fechaEscrita) ? fechaEscrita : null}
        alCambiar={(f) => {
          setFechaMarcada(false);
          setInicio(escribirFecha(f));
        }}
      />
      <CampoTexto
        testID="tanda-inicio"
        etiqueta={ETIQUETA_PRIMERA_FECHA}
        ejemplo={EJEMPLO_FECHA}
        ayuda={AYUDA_FECHA}
        error={fechaMarcada && fechaEscrita === null ? MARCA_FECHA_INVALIDA : null}
        teclado="numbers-and-punctuation"
        valor={inicio}
        alCambiar={(t) => {
          setFechaMarcada(false);
          setInicio(t);
        }}
      />
      <Chips
        testID="tanda-cuenta"
        etiqueta={ETIQUETA_CUENTA_APORTACION_OPCIONAL}
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={cuentaId}
        alCambiar={setCuentaId}
      />
      {propuesta ? (
        <Tarjeta testID="tanda-resumen">
          <Texto
            variante="cuerpo"
            accessibilityLiveRegion="polite"
            importantForAccessibility="yes"
            accessibilityLabel={etiquetaAccesibleResumenCobroFormulario(
              propuesta.cobro,
              etiquetaFecha(propuesta.fechaCobro),
              propuesta.turno,
              propuesta.participantes,
            )}
          >
            {textoResumenCobro(
              propuesta.cobro,
              etiquetaFecha(propuesta.fechaCobro),
              propuesta.turno,
              propuesta.participantes,
            )}
          </Texto>
          <Texto variante="secundario" tono="secundario" importantForAccessibility="no">
            {TEXTO_COMPROMISO_APORTACION}
          </Texto>
        </Tarjeta>
      ) : null}
      {ya ? (
        <Tarjeta testID="tanda-ya-empezo">
          <Texto variante="cuerpoFuerte" accessibilityRole="header">
            {TITULO_YA_EMPEZO}
          </Texto>
          <CampoTexto
            testID="tanda-hechas"
            etiqueta={ETIQUETA_APORTACIONES_HECHAS}
            ejemplo={String(ya.aportacionesHechas)}
            teclado="number-pad"
            valor={hechas ?? String(ya.aportacionesHechas)}
            alCambiar={setHechas}
          />
          <Chips
            testID="tanda-ya-cobraste"
            etiqueta={ETIQUETA_YA_TE_TOCO}
            opciones={OPCIONES_SI_NO}
            valor={cobro ?? (ya.yaCobraste ? 'si' : 'no')}
            alCambiar={setCobro}
          />
          {corregida ? (
            <Texto
              variante="secundario"
              testID="tanda-ya-empezo-texto"
              accessibilityLiveRegion="polite"
              importantForAccessibility="yes"
              accessibilityLabel={etiquetaAccesibleTextoYaEmpezo(corregida)}
            >
              {textoYaEmpezoCompleto(corregida)}
            </Texto>
          ) : null}
        </Tarjeta>
      ) : null}
      <MensajeError texto={error} />
      <Boton
        testID="tanda-guardar"
        etiqueta={ETIQUETA_GUARDAR_TANDA}
        alPresionar={guardar}
        pista={PISTA_GUARDAR_TANDA}
      />
      <Boton
        testID="tanda-cancelar"
        variante="texto"
        etiqueta={ETIQUETA_CANCELAR}
        alPresionar={alCancelar}
        pista={PISTA_CANCELAR_FORMULARIO}
      />
    </View>
  );
}
