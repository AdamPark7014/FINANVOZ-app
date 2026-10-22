import type { Centavos } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ERROR_GUARDAR, MensajeError, PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import {
  AYUDA_EFECTIVO_ONB,
  BTN_AGREGAR_DEBITO_BILLETERA,
  BTN_AGREGAR_TARJETA_CREDITO,
  BTN_ONB_CONTINUAR,
  ETIQUETA_CUENTA_GENERICA,
  ETIQUETA_EFECTIVO_ONB,
  ETIQUETA_TARJETA_DEBES,
  ETIQUETAS_SUBTIPO_CUENTA,
  PISTA_AGREGAR_TARJETA_ONB,
  PISTA_CUENTAS_CONTINUAR,
  SUFIJO_TIENES,
  TIP_CUENTAS_MINIMO,
  TITULO_CUENTAS,
} from '../../src/pantallas/onboarding/textos';
import { agregarEfectivo, listarCuentas } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { FormularioCuenta } from '../../src/pantallas/cuentas/FormularioCuenta';
import { Boton, CampoMonto, Cifra, espacio, Tarjeta, Texto } from '../../src/ui';

/**
 * O4 · Cuentas (`02 §3`): el efectivo es el mínimo; débito, billeteras y tarjetas de crédito (§3.1) son
 * opcionales. Cada saldo se guarda como saldo inicial en servicios.
 */
export default function Cuentas() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const vista = useVista(listarCuentas);
  const tieneEfectivo = vista.tienes.some((c) => c.subtipo === 'efectivo');
  const tarjetas = vista.debes.filter((d) => d.tipo === 'tarjeta');

  const [efectivo, setEfectivo] = useState<Centavos | null>(null);
  const [formulario, setFormulario] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <PasoOnboarding
      testID="onb-cuentas"
      paso={4}
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
      {tieneEfectivo ? null : (
        <CampoMonto
          testID="onb-efectivo"
          etiqueta={ETIQUETA_EFECTIVO_ONB}
          ayuda={AYUDA_EFECTIVO_ONB}
          alCambiar={setEfectivo}
        />
      )}

      {vista.tienes.length + tarjetas.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="onb-cuentas-lista">
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
        <FormularioCuenta alGuardar={() => setFormulario(false)} alCancelar={() => setFormulario(false)} />
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
