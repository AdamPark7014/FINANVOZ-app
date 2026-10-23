import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { aceptarConsentimiento } from '../servicios';
import { fijarConfirmarPorVoz, obtenerConfirmarPorVoz } from '../servicios/preferencias';
import { ProveedorSesion } from '../sesion/ProveedorSesion';
import { abrirPruebaPantalla } from '../pantallas/principal/__pruebas__/base';
import { crearMotorFalso } from '../voz/__pruebas__/motor-falso';
import {
  leerConfirmacion,
  LIMITE_CONFIRMACION_MS,
  useConfirmacionPorVoz,
  type ContextoConfirmacion,
  type OpcionesConfirmacionPorVoz,
} from './confirmacion-voz';

const CONTEXTO: ContextoConfirmacion = {
  fecha_referencia: '2026-10-11',
  cuentas: [
    { tipo: 'efectivo', alias: ['efectivo'] },
    { tipo: 'debito', alias: ['bbva'] },
    { tipo: 'credito', alias: ['nu'] },
  ],
};

type Props = Omit<OpcionesConfirmacionPorVoz, 'alSi' | 'alNo' | 'alCambio' | 'alOtro' | 'motor'>;

let prueba: ReturnType<typeof abrirPruebaPantalla>;

beforeEach(() => {
  prueba = abrirPruebaPantalla();
  aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
});

afterEach(() => {
  prueba.cerrar();
  jest.useRealTimers();
});

function montar(inicial: Props, { ctx = prueba.ctx, disponible = true } = {}) {
  const { motor, emitir } = crearMotorFalso({ disponible });
  const acciones = { alSi: jest.fn(), alNo: jest.fn(), alCambio: jest.fn(), alOtro: jest.fn() };
  const envoltura = ({ children }: { children: ReactNode }) => (
    <ProveedorSesion ctx={ctx} nube={null}>
      {children}
    </ProveedorSesion>
  );
  const hook = renderHook((p: Props) => useConfirmacionPorVoz({ ...p, ...acciones, motor }), {
    initialProps: inicial,
    wrapper: envoltura,
  });
  /** Deja que termine el permiso (asíncrono) y arranque el dictado. */
  const esperarInicio = () => act(async () => {});
  const decir = async (texto: string) => {
    await emitir({ tipo: 'inicio' });
    await emitir({ tipo: 'resultado', texto, final: true });
  };
  return { ...hook, motor, emitir, acciones, esperarInicio, decir };
}

const sinAcciones = (a: Record<string, jest.Mock>) => {
  for (const f of Object.values(a)) expect(f).not.toHaveBeenCalled();
};

describe('useConfirmacionPorVoz', () => {
  it('escucha un turno en es-MX en cuanto aparece la tarjeta y «sí» confirma', async () => {
    const h = montar({ activo: true, contexto: CONTEXTO });
    await h.esperarInicio();
    expect(h.motor.iniciar).toHaveBeenCalledTimes(1);
    expect(h.motor.iniciar).toHaveBeenCalledWith(expect.objectContaining({ idioma: 'es-MX' }));
    expect(h.result.current.escuchando).toBe(true);
    await h.decir('sí, porfa');
    expect(h.acciones.alSi).toHaveBeenCalledTimes(1);
    expect(h.acciones.alNo).not.toHaveBeenCalled();
    expect(h.acciones.alCambio).not.toHaveBeenCalled();
    expect(h.result.current.escuchando).toBe(false);
  });

  it('«no» lleva a cambiar', async () => {
    const h = montar({ activo: true });
    await h.esperarInicio();
    await h.decir('no');
    expect(h.acciones.alNo).toHaveBeenCalledTimes(1);
    expect(h.acciones.alSi).not.toHaveBeenCalled();
  });

  it('«no, fue con la Nu» cambia la fila de cuenta con el alias del contexto', async () => {
    const h = montar({ activo: true, contexto: CONTEXTO });
    await h.esperarInicio();
    await h.decir('no, fue con la Nu');
    expect(h.acciones.alCambio).toHaveBeenCalledWith({
      texto: 'fue con la Nu',
      cambios: [{ fila: 'cuenta', cuenta: { tipo: 'credito', alias: 'nu' } }],
    });
    expect(h.acciones.alSi).not.toHaveBeenCalled();
  });

  it('«eran 40 y fue ayer» cambia monto y fecha (fecha civil del contexto)', async () => {
    const h = montar({ activo: true, contexto: CONTEXTO });
    await h.esperarInicio();
    await h.decir('eran 40 y fue ayer');
    expect(h.acciones.alCambio).toHaveBeenCalledWith({
      texto: 'eran 40 y fue ayer',
      cambios: [
        { fila: 'monto', monto: 4000, aproximado: false },
        { fila: 'cuando', fecha: '2026-10-10' },
      ],
    });
  });

  it('lo que no entiende no confirma ni cambia: la tarjeta espera el toque', async () => {
    const h = montar({ activo: true, contexto: CONTEXTO });
    await h.esperarInicio();
    await h.decir('creo que sí');
    expect(h.acciones.alOtro).toHaveBeenCalledWith('creo que sí');
    expect(h.acciones.alSi).not.toHaveBeenCalled();
    expect(h.acciones.alNo).not.toHaveBeenCalled();
    expect(h.acciones.alCambio).not.toHaveBeenCalled();
  });

  it('una corrección que no es de una fila de la tarjeta no la cambia', async () => {
    const h = montar({ activo: true, contexto: { ...CONTEXTO, filas: ['monto', 'que'] } });
    await h.esperarInicio();
    await h.decir('no, fue con la Nu');
    expect(h.acciones.alCambio).not.toHaveBeenCalled();
    expect(h.acciones.alOtro).toHaveBeenCalledWith('no, fue con la Nu');
  });

  it('a los 6 s sin respuesta deja de escuchar y no hace nada, aunque llegue algo tarde', async () => {
    jest.useFakeTimers();
    const h = montar({ activo: true });
    await h.esperarInicio();
    act(() => {
      jest.advanceTimersByTime(LIMITE_CONFIRMACION_MS - 1);
    });
    expect(h.motor.abortar).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(h.motor.abortar).toHaveBeenCalledTimes(1);
    await h.decir('sí');
    sinAcciones(h.acciones);
  });

  it('si la persona toca algo se cancela y una respuesta tardía no hace nada', async () => {
    const h = montar({ activo: true });
    await h.esperarInicio();
    act(() => h.result.current.cancelar());
    expect(h.motor.abortar).toHaveBeenCalledTimes(1);
    await h.decir('sí');
    sinAcciones(h.acciones);
  });

  it('respeta el interruptor de Ajustes › Voz', async () => {
    expect(obtenerConfirmarPorVoz(prueba.ctx).activa).toBe(true);
    fijarConfirmarPorVoz(prueba.ctx, false);
    const h = montar({ activo: true });
    await h.esperarInicio();
    expect(h.motor.iniciar).not.toHaveBeenCalled();
    expect(h.result.current.escuchando).toBe(false);
  });

  it('solo escucha con la tarjeta activa; al resolverse por toque deja de escuchar', async () => {
    const h = montar({ activo: false });
    await h.esperarInicio();
    expect(h.motor.iniciar).not.toHaveBeenCalled();
    h.rerender({ activo: true });
    await h.esperarInicio();
    expect(h.motor.iniciar).toHaveBeenCalledTimes(1);
    h.rerender({ activo: false });
    expect(h.motor.abortar).toHaveBeenCalledTimes(1);
    await h.decir('sí');
    sinAcciones(h.acciones);
  });

  it('escucha un solo turno; con otra `clave` (tarjeta ya cambiada) vuelve a escuchar', async () => {
    const h = montar({ activo: true, clave: 1 });
    await h.esperarInicio();
    await h.decir('eran 40');
    expect(h.acciones.alCambio).toHaveBeenCalledTimes(1);
    h.rerender({ activo: true, clave: 1 });
    await h.esperarInicio();
    expect(h.motor.iniciar).toHaveBeenCalledTimes(1);
    h.rerender({ activo: true, clave: 2 });
    await h.esperarInicio();
    expect(h.motor.iniciar).toHaveBeenCalledTimes(2);
    await h.decir('sí');
    expect(h.acciones.alSi).toHaveBeenCalledTimes(1);
  });

  it('sin dictado en el teléfono no escucha', async () => {
    const h = montar({ activo: true }, { disponible: false });
    await h.esperarInicio();
    expect(h.motor.iniciar).not.toHaveBeenCalled();
  });

  it('al desmontarse deja de escuchar', async () => {
    const h = montar({ activo: true });
    await h.esperarInicio();
    h.unmount();
    expect(h.motor.abortar).toHaveBeenCalled();
  });
});

describe('leerConfirmacion (fachada)', () => {
  it.each([
    ['sí', { tipo: 'si' }],
    ['dale', { tipo: 'si' }],
    ['ándale', { tipo: 'si' }],
    ['así es', { tipo: 'si' }],
    ['nel', { tipo: 'no' }],
    ['mejor no', { tipo: 'no' }],
  ])('«%s»', (texto, esperado) => {
    expect(leerConfirmacion(texto, CONTEXTO)).toEqual(esperado);
  });

  it('un cambio trae lo dicho sin el «no» ni el «sí, pero» del principio', () => {
    expect(leerConfirmacion('No, fue con la Nu.', CONTEXTO)).toEqual({
      tipo: 'cambio',
      texto: 'fue con la Nu',
      cambios: [{ fila: 'cuenta', cuenta: { tipo: 'credito', alias: 'nu' } }],
    });
    expect(leerConfirmacion('sí, pero eran 40')).toEqual({
      tipo: 'cambio',
      texto: 'eran 40',
      cambios: [{ fila: 'monto', monto: 4000, aproximado: false }],
    });
  });

  it('una corrección que no se lee como fila se devuelve sin cambios, para el lector del paso o los chips', () => {
    expect(leerConfirmacion('no, cada semana')).toEqual({
      tipo: 'cambio',
      texto: 'cada semana',
      cambios: [],
    });
    expect(leerConfirmacion('fue con la Coppel', CONTEXTO)).toEqual({
      tipo: 'cambio',
      texto: 'fue con la Coppel',
      cambios: [],
    });
    // Sin contexto no hay alias: «la Nu» queda para que la tarjeta la busque entre sus chips.
    expect(leerConfirmacion('no, fue con la Nu')).toEqual({
      tipo: 'cambio',
      texto: 'fue con la Nu',
      cambios: [],
    });
    expect(leerConfirmacion('no, son 9 mil cada quincena')).toEqual({
      tipo: 'cambio',
      texto: 'son 9 mil cada quincena',
      cambios: [],
    });
  });

  it('ante la duda, null: nunca confirma algo ambiguo', () => {
    for (const texto of ['', 'creo que sí', 'sí, no', 'sí, con la Nu', 'ya', 'cada semana']) {
      expect(leerConfirmacion(texto, CONTEXTO)).toBeNull();
    }
  });
});
