import type { Centavos, DiaSemana, PlainDate } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Chips,
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
} from '../../src/pantallas/onboarding/componentes';
import { TIP_INGRESO_SALTAR } from '../../src/pantallas/onboarding/tips';
import {
  conceptoIngreso,
  leerDiaMes,
  OPCIONES_DIA_SEMANA,
  OPCIONES_FIN_DE_SEMANA,
  OPCIONES_FRECUENCIA,
  proximos14Dias,
  reglaDeIngreso,
  type FinDeSemana,
  type Frecuencia,
} from '../../src/pantallas/onboarding/ingreso';
import {
  configurarIngreso,
  configurarIngresoVariable,
  etiquetaFecha,
  proximoPago,
} from '../../src/servicios';
import { useSesion } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta, Texto } from '../../src/ui';

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
      titulo="¿Cada cuándo te pagan?"
      tip={TIP_INGRESO_SALTAR}
      pie={
        <>
          <Boton
            testID="onb-ingreso-continuar"
            etiqueta="Continuar"
            deshabilitado={!completo}
            alPresionar={guardar}
          />
          <Boton
            testID="onb-ingreso-saltar"
            variante="texto"
            etiqueta="Saltar por ahora"
            pista="Calcularé tu día con los próximos 30 días"
            alPresionar={() => seguir(() => configurarIngresoVariable(ctx))}
          />
        </>
      }
    >
      <Chips
        testID="onb-frecuencia"
        opciones={OPCIONES_FRECUENCIA}
        valor={frecuencia}
        alCambiar={setFrecuencia}
      />

      {variable ? (
        <Texto variante="cuerpo" tono="secundario">
          Sin problema: calcularé cuánto puedes gastar con los próximos 30 días.
        </Texto>
      ) : (
        <>
          {frecuencia === 'semanal' ? (
            <Chips
              testID="onb-dia-semana"
              etiqueta="¿Qué día te pagan?"
              opciones={OPCIONES_DIA_SEMANA}
              valor={diaSemana}
              alCambiar={setDiaSemana}
            />
          ) : null}
          {frecuencia === 'catorcenal' ? (
            <Chips
              testID="onb-ancla"
              etiqueta="¿Cuándo te pagan la próxima vez?"
              opciones={fechas}
              valor={ancla}
              alCambiar={setAncla}
            />
          ) : null}
          {frecuencia === 'mensual' ? (
            <CampoTexto
              testID="onb-dia-mes"
              etiqueta="¿Qué día del mes te pagan?"
              ejemplo="30"
              teclado="number-pad"
              valor={diaMesTexto}
              alCambiar={setDiaMesTexto}
              error={
                diaMesTexto !== '' && leerDiaMes(diaMesTexto) === null ? 'Escribe un día del 1 al 31.' : null
              }
            />
          ) : null}
          <CampoMonto
            testID="onb-ingreso-monto"
            etiqueta="¿Cuánto te pagan cada vez?"
            ayuda="Lo que te llega a la cuenta, ya con descuentos."
            alCambiar={setMonto}
          />
          <Chips
            testID="onb-fin-semana"
            etiqueta="Si cae en fin de semana te pagan:"
            opciones={OPCIONES_FIN_DE_SEMANA}
            valor={finDeSemana}
            alCambiar={setFinDeSemana}
          />
          {proximo ? (
            <Tarjeta testID="onb-proximo-pago">
              <Texto variante="secundario" tono="secundario">
                Tu próximo pago
              </Texto>
              <Texto variante="subtitulo">{etiquetaFecha(proximo)}</Texto>
            </Tarjeta>
          ) : null}
        </>
      )}
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
