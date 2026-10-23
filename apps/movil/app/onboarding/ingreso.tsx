import type { Centavos, DiaSemana, PlainDate, Regla } from '@cartera/core';
import type { LecturaPaso } from '@cartera/nlu';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Chips,
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
  pasoVisibleOnb,
} from '../../src/pantallas/onboarding/componentes';
import {
  DecirloPaso,
  type HerramientasDecirlo,
  type PropuestaDecirlo,
} from '../../src/pantallas/onboarding/DecirloPaso';
import {
  faltantesIngreso,
  filasIngreso,
  huecosIngreso,
  ingresoConLectura,
  reglaDeEstadoIngreso,
  type EstadoIngreso,
  type HuecoIngreso,
} from '../../src/pantallas/onboarding/decirlo';
import {
  conceptoIngreso,
  leerDiaMes,
  OPCIONES_DIA_SEMANA,
  OPCIONES_FIN_DE_SEMANA,
  OPCIONES_FRECUENCIA,
  proximos14Dias,
  type FinDeSemana,
  type Frecuencia,
} from '../../src/pantallas/onboarding/ingreso';
import {
  AYUDA_MONTO_INGRESO,
  BTN_CAMBIAR_ALGO,
  BTN_ONB_CONTINUAR,
  BTN_ONB_SALTAR,
  BTN_SI_ASI_ES,
  BTN_SI_SEGUIR,
  CUERPO_INGRESO_VARIABLE,
  EFECTO_APROXIMADO,
  EJEMPLO_DIA_MES_INGRESO,
  ERROR_DIA_MES_INGRESO,
  ETIQUETA_DIA_MES_INGRESO,
  ETIQUETA_DIA_SEMANA_INGRESO,
  ETIQUETA_FIN_DE_SEMANA_INGRESO,
  ETIQUETA_MONTO_INGRESO,
  ETIQUETA_PROXIMA_VEZ_INGRESO,
  ETIQUETA_PROXIMO_PAGO,
  etiquetaProximoPagoOnboarding,
  PISTA_COMPLETAR_INGRESO,
  PISTA_INGRESO_SALTAR,
  PISTA_ONB_CONTINUAR,
  TIP_INGRESO_SALTAR,
  TITULO_ENTENDI,
  TITULO_INGRESO,
  textoMeFalta,
} from '../../src/pantallas/onboarding/textos';
import {
  configurarIngreso,
  configurarIngresoVariable,
  etiquetaFecha,
  proximoPago,
} from '../../src/servicios';
import { contextoPasoOnboarding } from '../../src/servicios/onboarding';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, etiquetaHablada, Tarjeta, Texto } from '../../src/ui';

/**
 * O3 · Ingreso (`02 §3`): «Dímelo» («gano 13 mil cada quincena») → tarjeta «Entendí» → «Sí» guarda y pasa a O4
 * sin formulario (Ola 7 §7). Si falta un dato, «Sí» llena el formulario y lleva el foco a lo que falta. El
 * formulario (frecuencia en chips, monto y próximo pago precalculado) sigue ahí. Saltar = ingreso variable.
 */
export default function Ingreso() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const contexto = useVista(contextoPasoOnboarding);
  const hoy = ctx.reloj.hoy();
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('quincena');
  const [finDeSemana, setFinDeSemana] = useState<FinDeSemana>('antes');
  const [diaSemana, setDiaSemana] = useState<DiaSemana | null>(null);
  const [ancla, setAncla] = useState<PlainDate | null>(null);
  const [diaMesTexto, setDiaMesTexto] = useState('');
  const [monto, setMonto] = useState<Centavos | null>(null);
  // «Los días 10 y 25» dicho: los chips no lo muestran, pero es lo que se guarda.
  const [reglaDicha, setReglaDicha] = useState<Regla | null>(null);
  // Sube al llenar el formulario con lo dicho: los campos se vuelven a montar con el valor y el foco.
  const [versionCampos, setVersionCampos] = useState(0);
  const [hueco, setHueco] = useState<HuecoIngreso | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actual: EstadoIngreso = {
    frecuencia,
    finDeSemana,
    diaSemana,
    ancla,
    diaMes: leerDiaMes(diaMesTexto),
    monto,
    aproximado: false,
    reglaDicha,
  };
  const variable = frecuencia === 'varia';
  const regla = reglaDeEstadoIngreso(actual);
  const proximo = regla ? proximoPago(regla, hoy) : null;
  const fechas = proximos14Dias(hoy).map((f) => ({ valor: f, etiqueta: etiquetaFecha(f) }));
  const completo = variable || (regla !== null && monto !== null && monto > 0);

  const seguir = (accion: () => void) => {
    try {
      accion();
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    router.push('/onboarding/cuentas');
  };

  const guardar = () =>
    seguir(() => {
      if (variable || !regla || monto === null) configurarIngresoVariable(ctx);
      else configurarIngreso(ctx, { concepto: conceptoIngreso(frecuencia), monto, regla });
    });

  /** «Sí» con la lectura completa: guarda y pasa a O4. Si falla, la tarjeta lo dice y se puede reintentar. */
  const guardarDicho = (e: EstadoIngreso) => {
    const r = reglaDeEstadoIngreso(e);
    if (e.frecuencia === 'varia') configurarIngresoVariable(ctx);
    else if (r && e.monto !== null) {
      configurarIngreso(ctx, { concepto: conceptoIngreso(e.frecuencia), monto: e.monto, regla: r });
    } else return;
    refrescar();
    router.push('/onboarding/cuentas');
  };

  /** «Cambiar algo» o «Sí» con algo pendiente: lo dicho queda en el formulario y el foco va a lo que falta. */
  const llenar = (e: EstadoIngreso, enfocar: HuecoIngreso | null) => {
    setFrecuencia(e.frecuencia);
    setFinDeSemana(e.finDeSemana);
    setDiaSemana(e.diaSemana);
    setAncla(e.ancla);
    setDiaMesTexto(e.diaMes === null ? '' : String(e.diaMes));
    setMonto(e.monto);
    setReglaDicha(e.reglaDicha);
    setHueco(enfocar);
    setVersionCampos((v) => v + 1);
    setError(null);
  };

  const proponer = (l: LecturaPaso, { actualizar }: HerramientasDecirlo): PropuestaDecirlo | null => {
    if (l.paso !== 'ingreso') return null;
    const e = ingresoConLectura(actual, l);
    const r = reglaDeEstadoIngreso(e);
    const huecos = huecosIngreso(e);
    const listo = huecos.length === 0;
    const etiquetaFin = OPCIONES_FIN_DE_SEMANA.find((o) => o.valor === e.finDeSemana)?.etiqueta ?? '';
    const filas = filasIngreso(e, r ? proximoPago(r, hoy) : null, etiquetaFin).map((f) =>
      f.clave === 'fin_de_semana'
        ? {
            ...f,
            opciones: OPCIONES_FIN_DE_SEMANA,
            alCambiar: (v: string) => actualizar({ ...l, finDeSemana: v as FinDeSemana }),
          }
        : f,
    );
    const efecto = !listo ? textoMeFalta(faltantesIngreso(e)) : e.aproximado ? EFECTO_APROXIMADO : null;
    return {
      titulo: TITULO_ENTENDI,
      ...(e.frecuencia !== 'varia' && e.monto !== null ? { monto: e.monto } : {}),
      filas,
      ...(efecto ? { efecto } : {}),
      confirmar: listo
        ? { etiqueta: BTN_SI_ASI_ES, accion: () => guardarDicho(e) }
        : { etiqueta: BTN_SI_SEGUIR, accion: () => llenar(e, huecos[0] ?? null) },
      cambiar: { etiqueta: BTN_CAMBIAR_ALGO, accion: () => llenar(e, huecos[0] ?? null) },
    };
  };

  return (
    <PasoOnboarding
      testID="onb-ingreso"
      paso={pasoVisibleOnb(3)}
      titulo={TITULO_INGRESO}
      tip={TIP_INGRESO_SALTAR}
      pie={
        <>
          {completo ? null : (
            // Un botón gris sin razón parece roto: se dice qué falta.
            <Texto variante="secundario" tono="secundario" testID="onb-ingreso-falta">
              {PISTA_COMPLETAR_INGRESO}
            </Texto>
          )}
          <Boton
            testID="onb-ingreso-continuar"
            etiqueta={BTN_ONB_CONTINUAR}
            deshabilitado={!completo}
            pista={completo ? PISTA_ONB_CONTINUAR : PISTA_COMPLETAR_INGRESO}
            alPresionar={guardar}
          />
          <Boton
            testID="onb-ingreso-saltar"
            variante="texto"
            etiqueta={BTN_ONB_SALTAR}
            pista={PISTA_INGRESO_SALTAR}
            alPresionar={() => seguir(() => configurarIngresoVariable(ctx))}
          />
        </>
      }
    >
      <DecirloPaso
        testID="onb-ingreso-decir"
        pasos={['ingreso']}
        ejemplo="gano 13 mil cada quincena"
        correccion="no, son 12 mil"
        contexto={contexto}
        proponer={proponer}
      />
      <Chips
        testID="onb-frecuencia"
        opciones={OPCIONES_FRECUENCIA}
        valor={frecuencia}
        alCambiar={(f) => {
          setFrecuencia(f);
          setReglaDicha(null);
        }}
      />

      {variable ? (
        <Texto variante="cuerpo" tono="secundario">
          {CUERPO_INGRESO_VARIABLE}
        </Texto>
      ) : (
        <>
          {frecuencia === 'semanal' ? (
            <Chips
              key={`dia-semana-${versionCampos}`}
              testID="onb-dia-semana"
              etiqueta={ETIQUETA_DIA_SEMANA_INGRESO}
              opciones={OPCIONES_DIA_SEMANA}
              valor={diaSemana}
              alCambiar={setDiaSemana}
              enfocar={hueco === 'dia_semana'}
            />
          ) : null}
          {frecuencia === 'catorcenal' ? (
            <Chips
              key={`ancla-${versionCampos}`}
              testID="onb-ancla"
              etiqueta={ETIQUETA_PROXIMA_VEZ_INGRESO}
              opciones={fechas}
              valor={ancla}
              alCambiar={setAncla}
              enfocar={hueco === 'ancla'}
            />
          ) : null}
          {frecuencia === 'mensual' ? (
            <CampoTexto
              key={`dia-mes-${versionCampos}`}
              testID="onb-dia-mes"
              etiqueta={ETIQUETA_DIA_MES_INGRESO}
              ejemplo={EJEMPLO_DIA_MES_INGRESO}
              teclado="number-pad"
              valor={diaMesTexto}
              alCambiar={setDiaMesTexto}
              autoFocus={hueco === 'dia_mes'}
              error={diaMesTexto !== '' && leerDiaMes(diaMesTexto) === null ? ERROR_DIA_MES_INGRESO : null}
            />
          ) : null}
          <CampoMonto
            key={`monto-${versionCampos}`}
            valorInicial={monto}
            testID="onb-ingreso-monto"
            etiqueta={ETIQUETA_MONTO_INGRESO}
            ayuda={AYUDA_MONTO_INGRESO}
            alCambiar={setMonto}
            autoFocus={hueco === 'monto'}
          />
          <Chips
            testID="onb-fin-semana"
            etiqueta={ETIQUETA_FIN_DE_SEMANA_INGRESO}
            opciones={OPCIONES_FIN_DE_SEMANA}
            valor={finDeSemana}
            alCambiar={setFinDeSemana}
          />
          {proximo ? (
            <View
              testID="onb-proximo-pago"
              accessible
              accessibilityRole="text"
              accessibilityLabel={etiquetaHablada(etiquetaProximoPagoOnboarding(etiquetaFecha(proximo)))}
            >
              <Tarjeta>
                <Texto variante="secundario" tono="secundario" accessibilityElementsHidden>
                  {ETIQUETA_PROXIMO_PAGO}
                </Texto>
                <Texto variante="subtitulo" accessibilityElementsHidden>
                  {etiquetaFecha(proximo)}
                </Texto>
              </Tarjeta>
            </View>
          ) : null}
        </>
      )}
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
