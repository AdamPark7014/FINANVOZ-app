import type { ComponentProps } from 'react';
import { useRouter, type Router } from 'expo-router';
import { View } from 'react-native';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaCuentas } from '../../src/pantallas/principal';
import { ETIQUETA_ACCESIBILIDAD_PESTANA, TEST_ID_PANTALLA_PESTANA } from './pestanas-textos';

/** Callbacks de la pestaña Cuentas hacia el stack (`02 §11`). */
export function navegacionDesdeCuentas(router: Router): ComponentProps<typeof PantallaCuentas> {
  return {
    alAbrirAjustes: () => router.push('/ajustes'),
    alAbrirTarjeta: (id) => router.push({ pathname: '/tarjetas/[id]', params: { id } }),
    alAgregarTarjeta: () => router.push('/tarjetas/nueva'),
    alAbrirPersona: (id) => router.push({ pathname: '/persona/[id]', params: { id } }),
    alContarEfectivo: (cuentaId) => abrirArqueo(router, { cuentaId }),
    alAbrirTandas: () => router.push('/tandas'),
    alAbrirCompartidos: () => router.push('/compartido'),
    alAbrirSuscripciones: () => router.push('/suscripciones'),
    alAbrirDeducciones: () => router.push('/deducciones'),
  };
}

/**
 * Pestaña Cuentas (`02 §11`): Tienes · Debes · Compromisos. Sin datos, `PantallaCuentas` muestra
 * `TEXTO_CUENTAS_*_VACIO` (`cuentas-tienes-vacio`, `cuentas-debes-vacio`, `cuentas-compromisos-vacio`).
 */
export default function Cuentas() {
  const router = useRouter();
  return (
    <View
      style={{ flex: 1 }}
      testID={TEST_ID_PANTALLA_PESTANA.cuentas}
      accessibilityLabel={ETIQUETA_ACCESIBILIDAD_PESTANA.cuentas}
    >
      <PantallaCuentas {...navegacionDesdeCuentas(router)} />
    </View>
  );
}
