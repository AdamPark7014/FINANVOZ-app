import { randomBytes } from 'node:crypto';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { crearCriptoNoble } from '@cartera/sincronizacion/noble';
import { almacenEnMemoria } from '../db/llave';
import {
  aceptarConsentimiento,
  agregarCuenta,
  agregarGastoCompartido,
  crearGrupoCompartido,
  obtenerGrupoCompartido,
  salirDelGrupo,
  unirseConQr,
  type Conectividad,
  type DependenciasCompartido,
} from '../servicios';
import { servidorCompartidoFalso } from '../servicios/__pruebas__/compartido';
import { ProveedorSesion, useSesion } from '../sesion/ProveedorSesion';
import { abrirPruebaPantalla } from '../pantallas/principal/__pruebas__/base';
import { crearAntirrebote, ESPERA_SINCRONIZAR_MS, SincronizarCompartido } from './SincronizarCompartido';

function conectividadFalsa() {
  const oyentes = new Set<() => void>();
  const conectividad: Conectividad = {
    enLinea: async () => true,
    alReconectar: (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
  };
  return {
    conectividad,
    oyentes,
    reconectar: () => {
      for (const f of oyentes) f();
    },
  };
}

function telefono(servidor: ReturnType<typeof servidorCompartidoFalso>, usuario: string) {
  const p = abrirPruebaPantalla('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const cuenta = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const cliente = servidor.cliente(usuario);
  const deps: DependenciasCompartido = {
    cripto: crearCriptoNoble((n) => new Uint8Array(randomBytes(n))),
    almacen: almacenEnMemoria(),
    cliente,
  };
  return { ...p, cuenta, cliente, deps };
}

describe('antirrebote de la sincronización', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('varios disparos seguidos corren una sola vez, después de la espera', async () => {
    const correr = jest.fn(async () => {});
    const a = crearAntirrebote(correr, 1000);
    a.disparar();
    a.disparar();
    jest.advanceTimersByTime(999);
    a.disparar();
    expect(correr).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(correr).toHaveBeenCalledTimes(1);
  });

  it('nunca corre dos a la vez: lo que llega mientras corre se repite una sola vez al terminar', async () => {
    let terminar: () => void = () => {};
    const correr = jest.fn(
      () =>
        new Promise<void>((r) => {
          terminar = r;
        }),
    );
    const a = crearAntirrebote(correr, 10);
    a.disparar();
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(correr).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) {
      a.disparar();
      await act(async () => {
        jest.advanceTimersByTime(10);
      });
    }
    expect(correr).toHaveBeenCalledTimes(1);
    await act(async () => {
      terminar();
    });
    expect(correr).toHaveBeenCalledTimes(2);
    await act(async () => {
      terminar();
    });
    expect(correr).toHaveBeenCalledTimes(2);
  });

  it('un error no detiene los siguientes disparos y detener cancela lo que esperaba', async () => {
    const correr = jest.fn(async () => {
      throw new Error('sin red');
    });
    const a = crearAntirrebote(correr, 10);
    a.disparar();
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    a.disparar();
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(correr).toHaveBeenCalledTimes(2);
    a.disparar();
    a.detener();
    a.disparar();
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(correr).toHaveBeenCalledTimes(2);
  });
});

/** Deja a la prueba llamar `refrescar()` como lo hace cualquier escritura de la app. */
const sesion = { refrescar: () => {} };
function Refrescar() {
  const { refrescar } = useSesion();
  useEffect(() => {
    sesion.refrescar = refrescar;
  }, [refrescar]);
  return null;
}

function montar(
  t: ReturnType<typeof telefono>,
  red: ReturnType<typeof conectividadFalsa>,
  programar: (activo: boolean) => Promise<void>,
  deps: DependenciasCompartido = t.deps,
) {
  return render(
    <ProveedorSesion ctx={t.ctx} nube={null}>
      <Refrescar />
      <SincronizarCompartido deps={deps} conectividad={red.conectividad} programar={programar} />
    </ProveedorSesion>,
  );
}

describe('SincronizarCompartido (pendiente 145)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('la tarea queda registrada solo mientras hay un grupo abierto; al volver la red comparte lo pendiente', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const B = telefono(servidor, 'usuario-b');
    const red = conectividadFalsa();
    const programar = jest.fn<Promise<void>, [boolean]>(async () => {});
    const ui = montar(A, red, programar);
    expect(programar).toHaveBeenLastCalledWith(false);
    // Sin grupos no hay nada que oír.
    expect(red.oyentes.size).toBe(0);

    const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
    if (!creado.ok) throw new Error(creado.error);
    const unido = await unirseConQr(B.ctx, B.deps, creado.qr, 'Ana');
    if (!unido.ok) throw new Error(unido.error);
    // Un gasto sin conexión queda pendiente.
    A.cliente.red.caida = true;
    agregarGastoCompartido(A.ctx, A.deps, creado.grupoId, {
      total: 120000,
      pagueYo: true,
      miParteBp: 5000,
      descripcion: 'Súper',
      categoria: 'super',
      cuentaId: A.cuenta,
    });
    act(() => sesion.refrescar());
    expect(programar).toHaveBeenLastCalledWith(true);
    expect(red.oyentes.size).toBe(1);
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).pendientes).toBe(1);

    // Vuelve la red (tres avisos seguidos): una sola sincronización, después de la espera.
    A.cliente.red.caida = false;
    const publicar = jest.spyOn(A.cliente, 'publicar');
    act(() => {
      red.reconectar();
      red.reconectar();
      red.reconectar();
    });
    expect(publicar).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(ESPERA_SINCRONIZAR_MS);
    });
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(publicar).toHaveBeenCalledTimes(1);
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).pendientes).toBe(0);

    // Al salir del grupo ya no queda ninguno abierto: se quita la tarea y se deja de oír la red.
    expect(await salirDelGrupo(A.ctx, A.deps, creado.grupoId)).toEqual({ ok: true });
    act(() => sesion.refrescar());
    expect(programar).toHaveBeenLastCalledWith(false);
    expect(red.oyentes.size).toBe(0);
    ui.unmount();
    A.cerrar();
    B.cerrar();
  });

  it('sin el servicio en la nube no registra la tarea aunque haya grupos', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
    if (!creado.ok) throw new Error(creado.error);
    const red = conectividadFalsa();
    const programar = jest.fn<Promise<void>, [boolean]>(async () => {});
    const ui = montar(A, red, programar, { ...A.deps, cliente: null });
    expect(programar).toHaveBeenLastCalledWith(false);
    expect(red.oyentes.size).toBe(0);
    ui.unmount();
    A.cerrar();
  });
});
