import type { Centavos, DiaSemana, PlainDate } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Chips,
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
} from '../../src/pantallas/onboarding/componentes';
import {
  AYUDA_MONTO_INGRESO,
  BTN_ONB_CONTINUAR,
  BTN_ONB_SALTAR,
  CUERPO_INGRESO_VARIABLE,
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
  TITULO_INGRESO,
} from '../../src/pantallas/onboarding/textos';
import {
  conceptoIngreso,
  leerDiaMes,
  OPCIONES_DIA_SEMANA,
  OPCIONES_FIN_DE_SEMANA,
  OPCIONES_FRECUENCIA,
  proximos14Dias,
  reglaDeIngreso,
  respuestasDeIngresoDicho,
  type FinDeSemana,
  type Frecuencia,
} from '../../src/pantallas/onboarding/ingreso';
import {
  configurarIngreso,
  configurarIngresoVariable,
  etiquetaFecha,
  proximoPago,
} from '../../src/servicios';
import { interpretarIngresoDicho } from '@cartera/nlu';
import { DecirloPaso } from '../../src/pantallas/onboarding/DecirloPaso';
import { useSesion } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, etiquetaHablada, Tarjeta, Texto } from '../../src/ui';

/** O3 · Ingreso (`02 §3`): frecuencia en chips, monto y próximo pago precalculado. Saltar = ingreso variable. */
export default function Ingreso() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const hoy = ctx.reloj.hoy();
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('quincena');
  const [finDeSemana, setFinDeSemana] = useState<FinDeSemana>('antes');
  const [diaSemana, setDiaSemana] = useState<DiaSemana | null>(null);
  const [ancla, setAncla] = useState<PlainDate | null>(null);
  const [diaMesTexto, setDiaMesTexto] = useState('');
  const [monto, setMonto] = useState<Centavos | null>(null);
  // Sube al dictar el paso: el campo de monto se vuelve a montar con lo dicho.
  const [versionMonto, setVersionMonto] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const variable = frecuencia === 'varia';
  const regla = reglaDeIngreso({
    frecuencia,
    finDeSemana,
    diaSemana,
    ancla,
    diaMes: leerDiaMes(diaMesTexto),
  });
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

  return (
    <PasoOnboarding
      testID="onb-ingreso"
      paso={3}
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
        ejemplo="gano doce mil cada quincena"
        interpretar={interpretarIngresoDicho}
        alEntender={(d) => {
          const r = respuestasDeIngresoDicho(d);
          if (r.frecuencia) setFrecuencia(r.frecuencia);
          if (r.diaSemana) setDiaSemana(r.diaSemana);
          if (r.diaMesTexto) setDiaMesTexto(r.diaMesTexto);
          setMonto(r.monto);
          setVersionMonto((v) => v + 1);
        }}
      />
      <Chips
        testID="onb-frecuencia"
        opciones={OPCIONES_FRECUENCIA}
        valor={frecuencia}
        alCambiar={setFrecuencia}
      />

      {variable ? (
        <Texto variante="cuerpo" tono="secundario">
          {CUERPO_INGRESO_VARIABLE}
        </Texto>
      ) : (
        <>
          {frecuencia === 'semanal' ? (
            <Chips
              testID="onb-dia-semana"
              etiqueta={ETIQUETA_DIA_SEMANA_INGRESO}
              opciones={OPCIONES_DIA_SEMANA}
              valor={diaSemana}
              alCambiar={setDiaSemana}
            />
          ) : null}
          {frecuencia === 'catorcenal' ? (
            <Chips
              testID="onb-ancla"
              etiqueta={ETIQUETA_PROXIMA_VEZ_INGRESO}
              opciones={fechas}
              valor={ancla}
              alCambiar={setAncla}
            />
          ) : null}
          {frecuencia === 'mensual' ? (
            <CampoTexto
              testID="onb-dia-mes"
              etiqueta={ETIQUETA_DIA_MES_INGRESO}
              ejemplo={EJEMPLO_DIA_MES_INGRESO}
              teclado="number-pad"
              valor={diaMesTexto}
              alCambiar={setDiaMesTexto}
              error={diaMesTexto !== '' && leerDiaMes(diaMesTexto) === null ? ERROR_DIA_MES_INGRESO : null}
            />
          ) : null}
          <CampoMonto
            key={versionMonto}
            valorInicial={monto}
            testID="onb-ingreso-monto"
            etiqueta={ETIQUETA_MONTO_INGRESO}
            ayuda={AYUDA_MONTO_INGRESO}
            alCambiar={setMonto}
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
