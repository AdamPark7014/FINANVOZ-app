import type { ComponentProps } from 'react';
import { useRouter, type Router } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaCuentas } from '../../src/pantallas/principal';

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
 * `TEXTO_CUENTAS_TIENES_VACIO`, `TEXTO_CUENTAS_DEBES_VACIO` y `TEXTO_CUENTAS_COMPROMISOS_VACIO`.
 */
export default function Cuentas() {
  const router = useRouter();
  return <PantallaCuentas {...navegacionDesdeCuentas(router)} />;
}
