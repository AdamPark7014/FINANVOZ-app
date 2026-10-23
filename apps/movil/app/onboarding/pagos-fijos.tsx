import type { LecturaPaso } from '@cartera/nlu';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ERROR_GUARDAR,
  MensajeError,
  OMITIR_CAPTURA_ONB,
  PasoOnboarding,
  pasoVisibleOnb,
} from '../../src/pantallas/onboarding/componentes';
import { DecirloPaso, type PropuestaDecirlo } from '../../src/pantallas/onboarding/DecirloPaso';
import {
  faltantesPagos,
  filasPagos,
  planPagos,
  type PagoPlaneado,
} from '../../src/pantallas/onboarding/decirlo';
import { describirRegla, hastaDePago, totalMensual } from '../../src/pantallas/onboarding/pagos-fijos';
import {
  AYUDA_PAGOS_FIJOS,
  BTN_CAMBIAR_ALGO,
  BTN_ONB_CONTINUAR,
  BTN_ONB_SALTAR,
  BTN_PAGO_QUITAR,
  BTN_SI_SEGUIR,
  btnSiAgrega,
  etiquetaFilaPago,
  etiquetaPagosSuman,
  PISTA_PAGOS_CONTINUAR,
  PISTA_PAGOS_SALTAR,
  pistaQuitarPago,
  TEXTO_PAGOS_SUMAN,
  textoAgregue,
  textoCompletaAbajo,
  textoDimeDespues,
  textoMeFalta,
  TIP_PAGOS_SALTAR,
  TITULO_PAGOS_FIJOS,
  tituloEntendiAgrego,
} from '../../src/pantallas/onboarding/textos';
import {
  FormularioPagoFijo,
  primerHuecoPago,
  type PagoAgregado,
  type PagoFijoPrellenado,
} from '../../src/pantallas/pagos-fijos/FormularioPagoFijo';
import { etiquetaFecha, listarCuentas, PAGOS_FIJOS_SUGERIDOS, quitarPagoFijo } from '../../src/servicios';
import { agregarPagosFijosDichos, contextoPasoOnboarding } from '../../src/servicios/onboarding';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, Cifra, cifraEnPalabras, espacio, etiquetaHablada, Texto } from '../../src/ui';

type ClavePago = (typeof PAGOS_FIJOS_SUGERIDOS)[number]['clave'];

/**
 * O5 · Pagos fijos (`02 §3`): «Dímelo» («pago 4500 de renta cada mes el 5», o varios de una vez) → «Entendí» → «Sí»
 * agrega los que están completos (Ola 7 §7); al que le falta algo lo pone en el formulario para completarlo. El
 * formulario (`FormularioPagoFijo`) agrega uno a la vez; la lista deja quitar y dice cuánto suman al mes.
 */
export default function PagosFijos() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const contexto = useVista(contextoPasoOnboarding);
  const cuentas = useVista(listarCuentas);
  const [agregados, setAgregados] = useState<PagoAgregado[]>([]);
  // Lo dicho que va al formulario; `versionFormulario` lo vuelve a montar con eso.
  const [prellenado, setPrellenado] = useState<PagoFijoPrellenado | null>(null);
  const [versionFormulario, setVersionFormulario] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const salidas = [
    ...cuentas.tienes.map((c) => ({ id: c.id, nombre: c.nombre })),
    ...cuentas.debes.filter((d) => d.tipo === 'tarjeta').map((d) => ({ id: d.id, nombre: d.nombre })),
  ];

  const quitar = (p: PagoAgregado) => {
    try {
      quitarPagoFijo(ctx, p.id);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setAgregados((a) => a.filter((x) => x.id !== p.id));
    setError(null);
    refrescar();
  };

  /** Los pagos completos, todos o ninguno; si falla, la tarjeta «Entendí» lo dice y se puede reintentar. */
  const guardarDichos = (pagos: readonly PagoPlaneado<ClavePago>[]) => {
    if (pagos.length === 0) return;
    const hoy = ctx.reloj.hoy();
    const listos = pagos.flatMap((p) => {
      if (!p.regla) return [];
      const cuenta = salidas.find((c) => c.id === p.cuentaId) ?? null;
      const hasta = p.pagosRestantes ? hastaDePago(p.regla, hoy, p.pagosRestantes) : null;
      return [{ p, regla: p.regla, cuenta, hasta }];
    });
    const ids = agregarPagosFijosDichos(
      ctx,
      listos.map(({ p, regla, cuenta, hasta }) => ({
        concepto: p.conceptoGuardado,
        monto: p.monto,
        regla,
        categoria: p.categoria,
        cuentaId: cuenta?.id ?? null,
        variable: p.variable,
        hasta,
      })),
    );
    refrescar();
    setAgregados((a) => [
      ...a,
      ...listos.map(({ p, regla, cuenta, hasta }, i) => ({
        id: ids[i] ?? '',
        concepto: p.concepto,
        conceptoGuardado: p.conceptoGuardado,
        monto: p.monto,
        regla,
        cuenta: cuenta?.nombre ?? null,
        hasta,
      })),
    ]);
  };

  /** Un pago dicho al formulario, para completarlo o cambiarlo antes de agregarlo. */
  const llenar = (p: PagoPlaneado<ClavePago>) => {
    setPrellenado(p.prellenado);
    setVersionFormulario((v) => v + 1);
  };

  const proponer = (l: LecturaPaso): PropuestaDecirlo | null => {
    if (l.paso !== 'pagos_fijos') return null;
    const plan = planPagos(l.pagos, PAGOS_FIJOS_SUGERIDOS, salidas);
    const completos = plan.filter((p) => p.regla !== null);
    const incompletos = plan.filter((p) => p.regla === null);
    const [primero] = incompletos;
    const despues = incompletos.slice(1).map((p) => p.concepto);
    const hecho = [
      ...(completos.length > 0 ? [textoAgregue(completos.map((p) => p.concepto))] : []),
      ...(primero ? [textoCompletaAbajo(primero.concepto)] : []),
      ...(despues.length > 0 ? [textoDimeDespues(despues)] : []),
    ].join(' ');
    return {
      titulo: tituloEntendiAgrego(plan.length, 'm'),
      filas: filasPagos(plan),
      ...(primero ? { efecto: textoMeFalta(faltantesPagos(incompletos)) } : {}),
      confirmar: primero
        ? {
            etiqueta: BTN_SI_SEGUIR,
            accion: () => {
              guardarDichos(completos);
              llenar(primero);
            },
          }
        : { etiqueta: btnSiAgrega(plan.length, 'm'), accion: () => guardarDichos(completos) },
      cambiar: {
        etiqueta: BTN_CAMBIAR_ALGO,
        accion: () => {
          const [uno] = plan;
          if (uno) llenar(uno);
        },
      },
      hecho,
    };
  };

  const total = totalMensual(agregados);
  // Lo dicho llega al formulario con el foco en el primer dato que falta (Ola 7 §7).
  const enfocar = prellenado ? primerHuecoPago(prellenado) : null;

  return (
    <PasoOnboarding
      testID="onb-pagos-fijos"
      paso={pasoVisibleOnb(5)}
      titulo={TITULO_PAGOS_FIJOS}
      ayuda={AYUDA_PAGOS_FIJOS}
      tip={TIP_PAGOS_SALTAR}
      pie={
        <Boton
          testID="onb-pagos-continuar"
          etiqueta={agregados.length > 0 ? BTN_ONB_CONTINUAR : BTN_ONB_SALTAR}
          variante={agregados.length > 0 ? 'primario' : 'secundario'}
          pista={agregados.length > 0 ? PISTA_PAGOS_CONTINUAR : PISTA_PAGOS_SALTAR}
          alPresionar={() => router.push(OMITIR_CAPTURA_ONB ? '/onboarding/colchon' : '/onboarding/captura')}
        />
      }
    >
      <DecirloPaso
        testID="onb-pago-decir"
        pasos={['pagos_fijos']}
        ejemplo="pago 4500 de renta cada mes el 5"
        correccion="no, la renta son 5 mil"
        contexto={contexto}
        proponer={proponer}
      />
      <FormularioPagoFijo
        key={`pago-${versionFormulario}`}
        conDecirlo={false}
        {...(prellenado ? { prellenado } : {})}
        {...(enfocar ? { enfocar } : {})}
        alAgregado={(p) => {
          setPrellenado(null);
          setAgregados((a) => [...a, p]);
        }}
      />
      {agregados.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="onb-pagos-lista">
          {agregados.map((p) => {
            const regla = describirRegla(p.regla);
            const fin = p.hasta ? etiquetaFecha(p.hasta) : null;
            const detalle = [regla, p.cuenta ? `sale de ${p.cuenta}` : null, fin ? `hasta ${fin}` : null]
              .filter((x): x is string => x !== null)
              .join(' · ');
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                <View
                  testID={`onb-pago-agregado-${p.id}`}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={etiquetaHablada(
                    etiquetaFilaPago({
                      concepto: p.concepto,
                      regla,
                      montoEnPalabras: cifraEnPalabras(p.monto),
                      cuenta: p.cuenta,
                      fin,
                    }),
                  )}
                  style={{ flex: 1, gap: espacio.xs }}
                >
                  <View
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                  >
                    <Texto variante="cuerpo">{p.concepto}</Texto>
                    <Cifra centavos={p.monto} contexto={`${p.concepto}, ${regla}`} />
                  </View>
                  <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Texto variante="secundario">{detalle}</Texto>
                  </View>
                </View>
                <Boton
                  testID={`onb-pago-quitar-${p.id}`}
                  variante="secundario"
                  ancho="contenido"
                  etiqueta={BTN_PAGO_QUITAR}
                  pista={pistaQuitarPago(p.concepto)}
                  alPresionar={() => quitar(p)}
                />
              </View>
            );
          })}
          <View
            testID="onb-pagos-total"
            accessible
            accessibilityRole="text"
            accessibilityLabel={etiquetaHablada(etiquetaPagosSuman(cifraEnPalabras(total)))}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Texto variante="etiqueta">{TEXTO_PAGOS_SUMAN}</Texto>
              <Cifra centavos={total} contexto={TEXTO_PAGOS_SUMAN} />
            </View>
          </View>
        </View>
      ) : null}
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
