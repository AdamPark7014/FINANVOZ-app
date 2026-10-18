import { esFecha, type Centavos, type PlainDate, type Regla } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  crearTanda,
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
import { Boton, CampoMonto, CampoTexto, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { Chips, MensajeError } from '../onboarding/componentes';
import { leerEntero } from '../onboarding/ingreso';
import {
  EJEMPLO_FECHA,
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
  ETIQUETA_NOMBRE_OPCIONAL,
  ETIQUETA_PARTICIPANTES,
  ETIQUETA_PRIMERA_FECHA,
  ETIQUETA_TURNO,
  ETIQUETA_YA_TE_TOCO,
  OPCIONES_FRECUENCIA_TANDA,
  OPCIONES_SI_NO,
  SUFIJO_RONDAS_NO_APARTO,
  TEXTO_COMPROMISO_APORTACION,
  TITULO_YA_EMPEZO,
  errorTurno,
  textoResumenCobro,
  textoYaEmpezo,
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
      setError('No pude guardar la tanda. Revisa los datos.');
      return;
    }
    refrescar();
    alGuardar(creada);
  };

  return (
    <View style={{ gap: espacio.m }} testID="formulario-tanda">
      <CampoTexto
        testID="tanda-nombre"
        etiqueta="Nombre (opcional)"
        ejemplo="Tanda de la oficina"
        valor={nombre}
        alCambiar={setNombre}
      />
      <CampoMonto
        testID="tanda-aportacion"
        etiqueta="¿Cuánto das en cada ronda?"
        valorInicial={prellenado?.aportacion ?? null}
        alCambiar={setAportacion}
      />
      <Chips
        testID="tanda-frecuencia"
        etiqueta="¿Cada cuándo?"
        opciones={OPCIONES_FRECUENCIA_TANDA}
        valor={frecuencia}
        alCambiar={setFrecuencia}
      />
      <CampoTexto
        testID="tanda-participantes"
        etiqueta="¿Cuántos son?"
        ejemplo="10"
        teclado="number-pad"
        valor={participantes}
        alCambiar={setParticipantes}
      />
      <CampoTexto
        testID="tanda-turno"
        etiqueta="¿Qué número te toca?"
        ejemplo="4"
        teclado="number-pad"
        valor={turno}
        alCambiar={setTurno}
      />
      <CampoTexto
        testID="tanda-inicio"
        etiqueta="Primera fecha"
        ejemplo="16/10/2026"
        valor={inicio}
        alCambiar={setInicio}
      />
      <Chips
        testID="tanda-cuenta"
        etiqueta="¿De dónde sale tu aportación? (opcional)"
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={cuentaId}
        alCambiar={setCuentaId}
      />
      {propuesta ? (
        <Tarjeta testID="tanda-resumen">
          <Texto variante="cuerpo">
            {`Cobras ${formatearCentavos(propuesta.cobro)} el ${etiquetaFecha(propuesta.fechaCobro)} (ronda ${propuesta.turno} de ${propuesta.participantes}).`}
          </Texto>
          <Texto variante="secundario" tono="secundario">
            Cada aportación es un compromiso: la aparto de tu dinero libre el día que toca.
          </Texto>
        </Tarjeta>
      ) : null}
      {ya ? (
        <Tarjeta testID="tanda-ya-empezo">
          <Texto variante="cuerpoFuerte">Esta tanda ya empezó.</Texto>
          <CampoTexto
            testID="tanda-hechas"
            etiqueta="¿Cuántas aportaciones llevas?"
            ejemplo={String(ya.aportacionesHechas)}
            teclado="number-pad"
            valor={hechas ?? String(ya.aportacionesHechas)}
            alCambiar={setHechas}
          />
          <Chips
            testID="tanda-ya-cobraste"
            etiqueta="¿Ya te tocó?"
            opciones={OPCIONES_SI_NO}
            valor={cobro ?? (ya.yaCobraste ? 'si' : 'no')}
            alCambiar={setCobro}
          />
          {corregida ? (
            <Texto variante="secundario" testID="tanda-ya-empezo-texto">
              {`${textoYaEmpezo(corregida)}. Esas rondas no las vuelvo a apartar.`}
            </Texto>
          ) : null}
        </Tarjeta>
      ) : null}
      <MensajeError texto={error} />
      <Boton testID="tanda-guardar" etiqueta="Guardar tanda" alPresionar={guardar} />
      <Boton testID="tanda-cancelar" variante="texto" etiqueta="Cancelar" alPresionar={alCancelar} />
    </View>
  );
}
