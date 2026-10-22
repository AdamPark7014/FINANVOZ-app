import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;
import { View } from 'react-native';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaCuentas } from '../../src/pantallas/principal';
import { funcionesPlan } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { usePlanTienda } from '../../src/suscripciones/ProveedorPlan';
import { propsContenedorPestana } from './pestanas-textos';

/** Qué secciones tienen a dónde llevar en esta build: sin entrada que termine en una pantalla sin salida. */
export interface DisponiblesCuentas {
  /** Gastos compartidos necesitan el proxy (Supabase). */
  compartidos: boolean;
  /** Deducciones es de Plus: solo si ya lo tiene o hay tienda para contratarlo. */
  deducciones: boolean;
}

/** Callbacks de la pestaña Cuentas hacia el stack (`02 §11`). */
export function navegacionDesdeCuentas(
  router: Router,
  disponibles: DisponiblesCuentas = { compartidos: true, deducciones: true },
): ComponentProps<typeof PantallaCuentas> {
  return {
    alAbrirAjustes: () => router.push('/ajustes'),
    alAbrirTarjeta: (id) => router.push({ pathname: '/tarjetas/[id]', params: { id } }),
    alAgregarTarjeta: () => router.push('/tarjetas/nueva'),
    alAgregarCuenta: () => router.push('/cuenta-nueva'),
    alAgregarPagoFijo: () => router.push('/pago-fijo-nuevo'),
    alAbrirPersona: (id) => router.push({ pathname: '/persona/[id]', params: { id } }),
    alContarEfectivo: (cuentaId) => abrirArqueo(router, { cuentaId }),
    alAbrirTandas: () => router.push('/tandas'),
    ...(disponibles.compartidos ? { alAbrirCompartidos: () => router.push('/compartido') } : {}),
    alAbrirSuscripciones: () => router.push('/suscripciones'),
    ...(disponibles.deducciones ? { alAbrirDeducciones: () => router.push('/deducciones') } : {}),
  };
}

/**
 * Pestaña Cuentas (`02 §11`): Tienes · Debes · Compromisos. Sin datos, `PantallaCuentas` muestra
 * `TEXTO_CUENTAS_*_VACIO` (`cuentas-tienes-vacio`, `cuentas-debes-vacio`, `cuentas-compromisos-vacio`).
 */
export default function Cuentas() {
  const router = useRouter();
  const { nube } = useSesion();
  const { compras } = usePlanTienda();
  const plus = useVista(funcionesPlan);
  const disponibles = { compartidos: nube !== null, deducciones: plus.deducciones || compras !== null };
  return (
    <View style={{ flex: 1 }} {...propsContenedorPestana('cuentas')}>
      <PantallaCuentas {...navegacionDesdeCuentas(router, disponibles)} />
    </View>
  );
}
