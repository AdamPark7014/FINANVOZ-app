import { useState, type ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useConfirmacionAlVolver } from '../../src/pantallas/ajustes/confirmacion';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import {
  BTN_DOCK_AGREGAR,
  ETIQUETA_CERRAR_AGREGAR,
  ETIQUETA_DOCK_HABLAR_CUENTAS,
  PISTA_DOCK_AGREGAR,
} from '../../src/pantallas/asistente/textos';
import { MenuAgregar } from '../../src/pantallas/cuentas/MenuAgregar';
import { DockSeccion } from '../../src/pantallas/navegacion/DockSeccion';
import { useMedidasDock } from '../../src/pantallas/navegacion/DockVoz';
import { PantallaCuentas, useMostrarAviso } from '../../src/pantallas/principal';
import { funcionesPlan } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { usePlanTienda } from '../../src/suscripciones/ProveedorPlan';
import { propsContenedorPestana } from '../../src/rutas/pestanas-textos';

type Router = ReturnType<typeof useRouter>;

/** Qué secciones tienen a dónde llevar en esta build: sin entrada que termine en una pantalla sin salida. */
export interface DisponiblesCuentas {
  /** Gastos compartidos necesitan el proxy (Supabase). */
  compartidos: boolean;
  /** Deducciones es de Plus: solo si ya lo tiene o hay tienda para contratarlo. */
  deducciones: boolean;
}

/** Callbacks de la pantalla Cuentas hacia el stack (`02 §11`). */
export function navegacionDesdeCuentas(
  router: Router,
  disponibles: DisponiblesCuentas = { compartidos: true, deducciones: true },
): ComponentProps<typeof PantallaCuentas> {
  return {
    alAbrirTarjeta: (id) => router.push({ pathname: '/tarjetas/[id]', params: { id } }),
    alPagarTarjeta: (id) => router.push({ pathname: '/tarjetas/[id]', params: { id, pagar: '1' } }),
    alAgregarTarjeta: () => router.push('/tarjetas/nueva'),
    alAbrirPersona: (id) => router.push({ pathname: '/persona/[id]', params: { id } }),
    alContarEfectivo: (cuentaId) => abrirArqueo(router, { cuentaId }),
    alAbrirTandas: () => router.push('/tandas'),
    ...(disponibles.compartidos ? { alAbrirCompartidos: () => router.push('/compartido') } : {}),
    alAbrirSuscripciones: () => router.push('/suscripciones'),
    alAbrirDeducciones: () => router.push('/deducciones'),
    alAgregarCuenta: () => router.push('/cuentas/nueva'),
    alAbrirCuenta: (id) => router.push({ pathname: '/cuentas/[id]', params: { id } }),
    alAgregarPagoFijo: () => router.push('/pagos-fijos/nuevo'),
    alAbrirPagoFijo: (id) => router.push({ pathname: '/pagos-fijos/[id]', params: { id } }),
    alVerPagosFijos: () => router.push('/pagos-fijos'),
    alVerPersonas: () => router.push('/personas'),
  };
}

/**
 * Cuentas (`02 §11`): Tienes · Debes · Compromisos. Sin datos, `PantallaCuentas` muestra `TEXTO_CUENTAS_*_VACIO`
 * (`cuentas-tienes-vacio`, `cuentas-debes-vacio`, `cuentas-compromisos-vacio`). Al pie, el dock de voz con «Agregar»
 * (cuenta, tarjeta de crédito o pago fijo, dirección B). Al volver de agregar una cuenta o un pago fijo (o de quitarlo)
 * muestra «Listo: …» en el aviso inferior.
 */
export default function Cuentas() {
  const router = useRouter();
  const mostrar = useMostrarAviso();
  useConfirmacionAlVolver((mensaje) => mostrar({ mensaje }));
  const { nube } = useSesion();
  const { compras } = usePlanTienda();
  const plus = useVista(funcionesPlan);
  const disponibles = { compartidos: nube !== null, deducciones: plus.deducciones || compras !== null };
  const navegacion = navegacionDesdeCuentas(router, disponibles);
  const [agregando, setAgregando] = useState(false);
  const { abajo, ocupado } = useMedidasDock();
  return (
    <View style={{ flex: 1 }} {...propsContenedorPestana('cuentas')}>
      <PantallaCuentas {...navegacion} espacioInferior={ocupado} />
      {agregando ? (
        <MenuAgregar
          abajo={abajo}
          alCerrar={() => setAgregando(false)}
          {...(navegacion.alAgregarCuenta ? { alAgregarCuenta: navegacion.alAgregarCuenta } : {})}
          {...(navegacion.alAgregarTarjeta ? { alAgregarTarjeta: navegacion.alAgregarTarjeta } : {})}
          {...(navegacion.alAgregarPagoFijo ? { alAgregarPagoFijo: navegacion.alAgregarPagoFijo } : {})}
        />
      ) : null}
      <DockSeccion
        prefijoTestID="dock-cuentas"
        etiquetaHablar={ETIQUETA_DOCK_HABLAR_CUENTAS}
        derecha={{
          etiqueta: BTN_DOCK_AGREGAR,
          icono: 'mas',
          alPresionar: () => setAgregando((a) => !a),
          testID: 'boton-agregar',
          etiquetaAccesible: agregando ? ETIQUETA_CERRAR_AGREGAR : BTN_DOCK_AGREGAR,
          ...(agregando ? {} : { pista: PISTA_DOCK_AGREGAR }),
          abierto: agregando,
        }}
      />
    </View>
  );
}
