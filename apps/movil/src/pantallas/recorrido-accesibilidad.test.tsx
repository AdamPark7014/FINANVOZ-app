import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import Captura from '../../app/onboarding/captura';
import Colchon from '../../app/onboarding/colchon';
import Consentimiento from '../../app/onboarding/consentimiento';
import CuentasOnboarding from '../../app/onboarding/cuentas';
import Ingreso from '../../app/onboarding/ingreso';
import Bienvenida from '../../app/onboarding/index';
import OnboardingLayout from '../../app/onboarding/_layout';
import PagosFijos from '../../app/onboarding/pagos-fijos';
import TarjetaCredito from '../../app/onboarding/tarjeta';
import { Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';
import {
  aceptarConsentimiento,
  cargarEscenario,
  crearPersona,
  crearTanda,
  listarTarjetas,
  registrarMovimiento,
  type Contexto,
} from '../servicios';
import { ProveedorControlApp, type ControlApp } from '../sesion/ControlApp';
import { ProveedorSesion } from '../sesion/ProveedorSesion';
import { ProveedorPlan } from '../suscripciones/ProveedorPlan';
import { auditar, type Hallazgo } from './__pruebas__/accesibilidad';
import { PantallaArqueo } from './arqueo/PantallaArqueo';
import { PantallaAyuda } from './ayuda';
import { PantallaMeAlcanza } from './me-alcanza/PantallaMeAlcanza';
import { PantallaPersona } from './personas/PantallaPersona';
import { PantallaPlan } from './plan';
import { crearMotorFalso, navegacionFalsa } from './principal/__pruebas__/arnes';
import { abrirPruebaPantalla, activarPlus, escenario, vector } from './principal/__pruebas__/base';
import { PantallaCuentas } from './principal/PantallaCuentas';
import { PantallaHoy } from './principal/PantallaHoy';
import { PantallaMovimientos } from './principal/PantallaMovimientos';
import { PantallaRegistrar } from './principal/PantallaRegistrar';
import { ProveedorAvisos } from './principal/ProveedorAvisos';
import { CentroPrivacidad } from './privacidad/CentroPrivacidad';
import { PantallaRespaldo } from './respaldo/PantallaRespaldo';
import { crearRespaldoPrueba } from './respaldo/__pruebas__/respaldo';
import { PantallaSuscripciones } from './suscripciones';
import { PantallaTanda, PantallaTandas } from './tandas';
import { FormularioTarjetaNueva } from './tarjetas/FormularioTarjetaNueva';
import { PantallaTarjeta } from './tarjetas/PantallaTarjeta';
import { crearSesionPrueba } from './onboarding/__pruebas__/sesion';

/**
 * M13 · pase de accesibilidad (RNF-08, `02 §15`): recorre las pantallas principales con datos (e5-10 con Plus,
 * personas, una tanda y efectivo) y falla con cualquier hallazgo de la auditoría en su modo estricto: todo lo
 * tocable con rol y `accessibilityLabel` propia, ≥ 48 dp; todo campo con etiqueta; toda cifra en palabras y sin
 * tamaños fijos; nada truncado. TalkBack y el texto al 200 % en el teléfono siguen como pendiente en ESTADO.
 */

const T0 = Date.UTC(2026, 9, 11, 18, 0, 0);

function preparar() {
  const p = abrirPruebaPantalla();
  const e = cargarEscenario(p.ctx, escenario('e5-10'));
  p.reloj.fijar(e.hoy);
  p.reloj.fijarInstante(T0);
  activarPlus(p.ctx);
  const tarjetas = listarTarjetas(p.ctx).map((t) => t.id);
  expect(tarjetas).toHaveLength(3);
  const efectivo = Object.values(e.cuentas).find((id) => !tarjetas.includes(id)) as string;
  registrarMovimiento(p.ctx, {
    tipo: 'gasto',
    categoria: 'comida_fuera',
    origenId: efectivo,
    monto: 8_000,
    descripcion: 'Tacos',
  });
  const caro = crearPersona(p.ctx, { nombre: 'Caro' });
  return { ...p, e, tarjetas, efectivo, caro };
}

function montar(ctx: Contexto, ui: ReactNode, control: ControlApp = { borrarTodo: async () => {} }) {
  return render(
    <ProveedorControlApp control={control}>
      <ProveedorSesion ctx={ctx} nube={null}>
        <ProveedorPlan compras={null} abrirPlan={null}>
          <ProveedorAvisos>{ui}</ProveedorAvisos>
        </ProveedorPlan>
      </ProveedorSesion>
    </ProveedorControlApp>,
  );
}

const hallazgos = (): Hallazgo[] => auditar(screen.toJSON() as never, { etiquetaExplicita: true });

/** Cuántos elementos tocables tiene el árbol (para que la auditoría no pase en vacío). */
function tocables(n: unknown): number {
  if (!n || typeof n !== 'object') return 0;
  if (Array.isArray(n)) return n.reduce((s: number, h) => s + tocables(h), 0);
  const nodo = n as { props: Record<string, unknown>; children: unknown[] | null };
  const propio = typeof nodo.props.onClick === 'function' && nodo.props.accessibilityRole !== 'text' ? 1 : 0;
  return propio + tocables(nodo.children);
}

/** Cada pantalla con su nombre, para que el fallo diga dónde; una pantalla sin nada tocable es un error. */
function revisar(nombre: string): [string, Hallazgo[]] {
  const arbol = screen.toJSON();
  if (tocables(arbol) === 0) return [nombre, [{ regla: 'pantalla sin elementos tocables', donde: nombre }]];
  return [nombre, hallazgos()];
}

describe('recorrido de accesibilidad (M13, RNF-08)', () => {
  it('la auditoría estricta marca un tocable sin etiqueta propia, sin rol o sin nombre', () => {
    render(
      <>
        <Pressable onPress={jest.fn()} accessibilityRole="button" style={{ minHeight: 48 }}>
          <Text>Guardar</Text>
        </Pressable>
        <Pressable onPress={jest.fn()} accessibilityLabel="Cerrar" style={{ minHeight: 48 }} />
        <Pressable onPress={jest.fn()} accessibilityRole="button" style={{ minHeight: 48 }} />
      </>,
    );
    expect(hallazgos().map((h) => h.regla)).toEqual([
      'tocable sin accessibilityLabel',
      'tocable sin rol',
      'tocable sin nombre',
      'tocable sin accessibilityLabel',
    ]);
    // Sin el modo estricto, el texto de los hijos basta como nombre.
    expect(auditar(screen.toJSON() as never).map((h) => h.regla)).toEqual([
      'tocable sin rol',
      'tocable sin nombre',
    ]);
  });

  it('Hoy, Registrar, Movimientos y Cuentas', () => {
    const p = preparar();
    const r: [string, Hallazgo[]][] = [];
    const v = montar(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    r.push(revisar('Hoy'));
    fireEvent.press(screen.getByTestId('boton-desglose'));
    r.push(revisar('Hoy con desglose'));
    v.unmount();

    const reg = montar(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} motor={crearMotorFalso().motor} />);
    r.push(revisar('Registrar'));
    reg.unmount();

    const mov = montar(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} alRevisar={jest.fn()} />);
    r.push(revisar('Movimientos'));
    mov.unmount();

    montar(
      p.ctx,
      <PantallaCuentas
        alAbrirTarjeta={jest.fn()}
        alAgregarTarjeta={jest.fn()}
        alAbrirPersona={jest.fn()}
        alContarEfectivo={jest.fn()}
        alAbrirTandas={jest.fn()}
        alAbrirSuscripciones={jest.fn()}
        alAbrirDeducciones={jest.fn()}
      />,
    );
    r.push(revisar('Cuentas'));
    expect(r.filter(([, h]) => h.length > 0)).toEqual([]);
    p.cerrar();
  });

  it('tarjetas: detalle de cada una y alta', () => {
    const p = preparar();
    const r: [string, Hallazgo[]][] = [];
    for (const id of p.tarjetas) {
      const v = montar(p.ctx, <PantallaTarjeta tarjetaId={id} alVolver={jest.fn()} />);
      expect(screen.getByTestId('tarjeta-corregir')).toBeTruthy();
      r.push(revisar(`Tarjeta ${id}`));
      v.unmount();
    }
    montar(p.ctx, <FormularioTarjetaNueva alGuardar={jest.fn()} alCancelar={jest.fn()} />);
    r.push(revisar('Tarjeta nueva'));
    expect(r.filter(([, h]) => h.length > 0)).toEqual([]);
    p.cerrar();
  });

  it('personas, tandas y suscripciones', () => {
    const p = preparar();
    const v11 = vector<{
      aportacion: number;
      participantes: number;
      turno: number;
      regla: never;
      inicio: string;
    }>('E11-01');
    const { tandaId } = crearTanda(p.ctx, {
      nombre: 'Tanda de la oficina',
      aportacion: v11.aportacion,
      participantes: v11.participantes,
      turno: v11.turno,
      regla: v11.regla,
      inicio: v11.inicio,
    });
    const r: [string, Hallazgo[]][] = [];
    let v = montar(p.ctx, <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />);
    r.push(revisar('Persona'));
    v.unmount();
    v = montar(p.ctx, <PantallaTandas alVolver={jest.fn()} alAbrirTanda={jest.fn()} />);
    r.push(revisar('Tandas'));
    v.unmount();
    v = montar(p.ctx, <PantallaTanda tandaId={tandaId} alVolver={jest.fn()} />);
    r.push(revisar('Tanda'));
    v.unmount();
    montar(p.ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    r.push(revisar('Suscripciones'));
    expect(r.filter(([, h]) => h.length > 0)).toEqual([]);
    p.cerrar();
  });

  it('arqueo, ¿Me alcanza?, plan, privacidad, respaldo y ayuda', async () => {
    const p = preparar();
    const r: [string, Hallazgo[]][] = [];
    let v = montar(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    r.push(revisar('Arqueo'));
    v.unmount();

    v = montar(p.ctx, <PantallaMeAlcanza alCerrar={jest.fn()} alVerMovimientos={jest.fn()} />);
    r.push(revisar('¿Me alcanza?'));
    v.unmount();

    v = montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />);
    await act(async () => {});
    r.push(revisar('Plan'));
    v.unmount();

    const respaldo = crearRespaldoPrueba();
    const control: ControlApp = {
      borrarTodo: async () => {},
      respaldo: { deps: respaldo.deps, archivos: respaldo.archivos, restaurar: async () => {} },
    } as ControlApp;
    v = montar(
      p.ctx,
      <CentroPrivacidad
        alVolver={jest.fn()}
        alLeerAviso={jest.fn()}
        alLeerTerminos={jest.fn()}
        alBorrarTodo={async () => {}}
        alRestaurar={jest.fn()}
      />,
      control,
    );
    r.push(revisar('Privacidad'));
    fireEvent.press(screen.getByTestId('privacidad-borrar-iniciar'));
    r.push(revisar('Privacidad · borrar todo'));
    v.unmount();

    v = montar(p.ctx, <PantallaRespaldo alVolver={jest.fn()} alRestaurar={jest.fn()} />, control);
    r.push(revisar('Respaldo'));
    v.unmount();

    montar(p.ctx, <PantallaAyuda alVolver={jest.fn()} abrirEnlace={jest.fn(async () => {})} />);
    r.push(revisar('Ayuda'));
    expect(r.filter(([, h]) => h.length > 0)).toEqual([]);
    p.cerrar();
  });

  it('onboarding: cada paso', () => {
    const rutas = {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      'onboarding/_layout': OnboardingLayout,
      'onboarding/index': Bienvenida,
      'onboarding/consentimiento': Consentimiento,
      'onboarding/ingreso': Ingreso,
      'onboarding/cuentas': CuentasOnboarding,
      'onboarding/tarjeta': TarjetaCredito,
      'onboarding/pagos-fijos': PagosFijos,
      'onboarding/captura': Captura,
      'onboarding/colchon': Colchon,
    };
    const r: [string, Hallazgo[]][] = [];
    const s = crearSesionPrueba('2026-10-11');
    for (const paso of ['', '/consentimiento']) {
      const v = renderRouter(rutas, { initialUrl: `/onboarding${paso}`, wrapper: s.Envoltura });
      r.push(revisar(`Onboarding ${paso || '/'}`));
      v.unmount();
    }
    aceptarConsentimiento(s.ctx, { datosFinancieros: true });
    for (const paso of ['/ingreso', '/cuentas', '/tarjeta', '/pagos-fijos', '/captura', '/colchon']) {
      const v = renderRouter(rutas, { initialUrl: `/onboarding${paso}`, wrapper: s.Envoltura });
      expect(v.getPathname()).toBe(`/onboarding${paso}`);
      r.push(revisar(`Onboarding ${paso}`));
      v.unmount();
    }
    expect(r.filter(([, h]) => h.length > 0)).toEqual([]);
    s.cerrar();
  });
});
