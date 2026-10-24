import type { Centavos } from '@cartera/core';
import type { LecturaPaso } from '@cartera/nlu';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
  pasoVisibleOnb,
} from '../../src/pantallas/onboarding/componentes';
import { DecirloPaso, type PropuestaDecirlo } from '../../src/pantallas/onboarding/DecirloPaso';
import {
  dejarTarjetaDicha,
  efectoCuentas,
  entradasCuentas,
  entradaTarjeta,
  faltantesTarjeta,
  filasCuentas,
  filasTarjeta,
  nombresCuentas,
  planCuentas,
  type PlanCuentas,
} from '../../src/pantallas/onboarding/decirlo';
import {
  AYUDA_EFECTIVO_ONB,
  BTN_AGREGAR_DEBITO_BILLETERA,
  BTN_AGREGAR_TARJETA_CREDITO,
  BTN_CAMBIAR_ALGO,
  BTN_ENTENDIDO,
  BTN_ONB_CONTINUAR,
  BTN_SI_SEGUIR,
  btnSiAgrega,
  ETIQUETA_CUENTA_GENERICA,
  ETIQUETA_EFECTIVO_ONB,
  ETIQUETA_TARJETA_DEBES,
  ETIQUETAS_SUBTIPO_CUENTA,
  PISTA_AGREGAR_TARJETA_ONB,
  PISTA_CUENTAS_CONTINUAR,
  SUFIJO_TIENES,
  TEXTO_NADA_NUEVO,
  textoAgregue,
  textoMeFalta,
  textoTarjetaAgregada,
  TIP_CUENTAS_MINIMO,
  TITULO_CUENTAS,
  TITULO_ENTENDI,
  tituloEntendiAgrego,
} from '../../src/pantallas/onboarding/textos';
import { agregarEfectivo, agregarTarjetaCredito, listarCuentas } from '../../src/servicios';
import { agregarCuentasDichas, contextoPasoOnboarding } from '../../src/servicios/onboarding';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import {
  FormularioCuenta,
  primerHuecoCuenta,
  type CuentaPrellenada,
} from '../../src/pantallas/cuentas/FormularioCuenta';
import { Boton, CampoMonto, Cifra, espacio, Tarjeta, Texto } from '../../src/ui';

/**
 * O4 · Cuentas (`02 §3`): el efectivo es el mínimo; débito, billeteras y tarjetas de crédito (§3.1) son
 * opcionales. «Dímelo» («tengo 3 mil en BBVA y 500 en efectivo», o una tarjeta: «tengo una Nu que corta el 28 y
 * pago el 18») → «Entendí» → «Sí» agrega lo dicho si está completo (Ola 7 §7); a la tarjeta le suele faltar algo y
 * «Sí» abre su formulario con lo dicho. Cada saldo se guarda como saldo inicial en servicios.
 */
export default function Cuentas() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const vista = useVista(listarCuentas);
  const contexto = useVista(contextoPasoOnboarding);
  const tieneEfectivo = vista.tienes.some((c) => c.subtipo === 'efectivo');
  const tarjetas = vista.debes.filter((d) => d.tipo === 'tarjeta');

  const [efectivo, setEfectivo] = useState<Centavos | null>(null);
  const [formulario, setFormulario] = useState(false);
  const [prellenado, setPrellenado] = useState<CuentaPrellenada | null>(null);
  // Sube al llenar con lo dicho: el efectivo y el formulario se vuelven a montar con el valor y el foco.
  const [versionCampos, setVersionCampos] = useState(0);
  const [enfocarEfectivo, setEnfocarEfectivo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existentes = [
    ...vista.tienes.map((c) => ({ nombre: c.nombre, subtipo: c.subtipo })),
    ...tarjetas.map((t) => ({ nombre: t.nombre, subtipo: 'tarjeta_credito' })),
  ];

  const continuar = () => {
    try {
      // Sin cifra, el efectivo empieza en $0: contar de menos lo que tienes nunca infla tu día.
      if (!tieneEfectivo) agregarEfectivo(ctx, efectivo ?? 0);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    router.push('/onboarding/pagos-fijos');
  };

  /** «Cambiar algo»: el efectivo dicho queda en su campo y la primera cuenta en el formulario, para revisarlos. */
  const llenar = (plan: PlanCuentas) => {
    if (plan.efectivo) setEfectivo(plan.efectivo.monto);
    const [primera] = plan.nuevas;
    setPrellenado(
      primera ? { tipo: primera.subtipo, nombre: primera.nombre, saldo: primera.saldo.monto } : null,
    );
    if (primera) setFormulario(true);
    setEnfocarEfectivo(plan.efectivo !== null && !primera);
    setVersionCampos((v) => v + 1);
  };

  const proponer = (l: LecturaPaso): PropuestaDecirlo | null => {
    if (l.paso === 'cuentas') {
      const plan = planCuentas(l, existentes);
      const n = plan.nuevas.length + (plan.efectivo ? 1 : 0);
      const efecto = efectoCuentas(plan);
      if (n === 0) {
        return {
          titulo: TITULO_ENTENDI,
          filas: [],
          efecto: efecto ?? TEXTO_NADA_NUEVO,
          confirmar: { etiqueta: BTN_ENTENDIDO, accion: () => {} },
        };
      }
      return {
        titulo: tituloEntendiAgrego(n, 'f'),
        filas: filasCuentas(plan),
        ...(efecto ? { efecto } : {}),
        confirmar: {
          etiqueta: btnSiAgrega(n, 'f'),
          accion: () => {
            agregarCuentasDichas(ctx, entradasCuentas(plan));
            refrescar();
          },
        },
        cambiar: { etiqueta: BTN_CAMBIAR_ALGO, accion: () => llenar(plan) },
        hecho: textoAgregue(nombresCuentas(plan)),
      };
    }
    if (l.paso === 'tarjeta') {
      const entrada = entradaTarjeta(l);
      const abrir = () => {
        dejarTarjetaDicha(l);
        router.push('/onboarding/tarjeta');
      };
      return {
        titulo: tituloEntendiAgrego(1, 'f'),
        filas: filasTarjeta(l),
        ...(entrada ? {} : { efecto: textoMeFalta(faltantesTarjeta(l)) }),
        confirmar: entrada
          ? {
              etiqueta: btnSiAgrega(1, 'f'),
              accion: () => {
                agregarTarjetaCredito(ctx, entrada);
                refrescar();
              },
            }
          : { etiqueta: BTN_SI_SEGUIR, accion: abrir },
        cambiar: { etiqueta: BTN_CAMBIAR_ALGO, accion: abrir },
        ...(entrada ? { hecho: textoTarjetaAgregada(entrada.nombre) } : {}),
      };
    }
    return null;
  };

  return (
    <PasoOnboarding
      testID="onb-cuentas"
      paso={pasoVisibleOnb(4)}
      titulo={TITULO_CUENTAS}
      tip={TIP_CUENTAS_MINIMO}
      pie={
        <Boton
          testID="onb-cuentas-continuar"
          etiqueta={BTN_ONB_CONTINUAR}
          pista={PISTA_CUENTAS_CONTINUAR}
          alPresionar={continuar}
        />
      }
    >
      <DecirloPaso
        testID="onb-cuentas-decir"
        pasos={['cuentas', 'tarjeta']}
        ejemplo="tengo 3 mil en BBVA y 500 en efectivo"
        correccion="no, son 4 mil en BBVA"
        contexto={contexto}
        proponer={proponer}
      />
      {tieneEfectivo ? null : (
        <CampoMonto
          key={`efectivo-${versionCampos}`}
          testID="onb-efectivo"
          etiqueta={ETIQUETA_EFECTIVO_ONB}
          ayuda={AYUDA_EFECTIVO_ONB}
          valorInicial={efectivo}
          alCambiar={setEfectivo}
          autoFocus={enfocarEfectivo}
          admiteCero
        />
      )}

      {vista.tienes.length + tarjetas.length > 0 ? (
        <View style={{ gap: espacio.m }} testID="onb-cuentas-lista">
          {vista.tienes.map((c) => (
            <Tarjeta key={c.id}>
              <Texto variante="cuerpoFuerte">{c.nombre}</Texto>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto variante="secundario" tono="secundario">
                  {`${ETIQUETAS_SUBTIPO_CUENTA[c.subtipo] ?? ETIQUETA_CUENTA_GENERICA}${SUFIJO_TIENES}`}
                </Texto>
                <Cifra centavos={c.saldo} contexto={`En ${c.nombre} tienes`} />
              </View>
            </Tarjeta>
          ))}
          {tarjetas.map((t) => (
            <Tarjeta key={t.id}>
              <Texto variante="cuerpoFuerte">{t.nombre}</Texto>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto variante="secundario" tono="secundario">
                  {ETIQUETA_TARJETA_DEBES}
                </Texto>
                <Cifra centavos={t.saldo + t.meses} contexto={`En ${t.nombre} debes`} />
              </View>
            </Tarjeta>
          ))}
        </View>
      ) : null}

      {formulario ? (
        <FormularioCuenta
          key={`cuenta-${versionCampos}`}
          // Lo dicho llega con el foco en el primer dato que falta (Ola 7 §7); «Agregar cuenta» a mano, sin foco.
          {...(prellenado ? { prellenado, enfocar: primerHuecoCuenta(prellenado) } : {})}
          alGuardar={() => {
            setFormulario(false);
            setPrellenado(null);
          }}
          alCancelar={() => {
            setFormulario(false);
            setPrellenado(null);
          }}
        />
      ) : (
        <Boton
          testID="onb-agregar-cuenta"
          variante="secundario"
          etiqueta={BTN_AGREGAR_DEBITO_BILLETERA}
          alPresionar={() => setFormulario(true)}
        />
      )}
      <Boton
        testID="onb-agregar-tarjeta"
        variante="secundario"
        etiqueta={BTN_AGREGAR_TARJETA_CREDITO}
        pista={PISTA_AGREGAR_TARJETA_ONB}
        alPresionar={() => router.push('/onboarding/tarjeta')}
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
