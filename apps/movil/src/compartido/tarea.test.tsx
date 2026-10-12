import { randomBytes } from 'node:crypto';
import { crearCriptoNoble } from '@cartera/sincronizacion/noble';
import { almacenEnMemoria } from '../db/llave';
import {
  aceptarConsentimiento,
  agregarCuenta,
  agregarGastoCompartido,
  crearGrupoCompartido,
  obtenerGrupoCompartido,
  unirseConQr,
  type DependenciasCompartido,
} from '../servicios';
import { servidorCompartidoFalso } from '../servicios/__pruebas__/compartido';
import type { Sesion } from '../servicios/sesion';
import { abrirPruebaPantalla } from '../pantallas/principal/__pruebas__/base';
import { INTERVALO_TAREA_MIN, programarSincronizacionCompartido, TAREA_COMPARTIDO } from './programar';
import { sincronizarEnSegundoPlano } from './tarea';

// Los módulos nativos no existen en jest: la tarea recibe cómo abrir la base y sus dependencias.
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));
jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  registerTaskAsync: jest.fn(async () => {}),
  unregisterTaskAsync: jest.fn(async () => {}),
}));
jest.mock('../servicios/sesion', () => ({ abrirSesion: jest.fn() }));
jest.mock('./expo', () => ({ dependenciasCompartidoExpo: jest.fn() }));

const TaskManager = jest.requireMock<{
  defineTask: jest.Mock;
  isTaskRegisteredAsync: jest.Mock;
}>('expo-task-manager');
const BackgroundTask = jest.requireMock<{ registerTaskAsync: jest.Mock; unregisterTaskAsync: jest.Mock }>(
  'expo-background-task',
);

const abiertas: (() => void)[] = [];
afterEach(() => {
  for (const cerrar of abiertas.splice(0)) cerrar();
});

function telefono(servidor: ReturnType<typeof servidorCompartidoFalso>, usuario: string) {
  const p = abrirPruebaPantalla('2026-10-11');
  abiertas.push(p.cerrar);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const cuenta = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const cliente = servidor.cliente(usuario);
  const deps: DependenciasCompartido = {
    cripto: crearCriptoNoble((n) => new Uint8Array(randomBytes(n))),
    almacen: almacenEnMemoria(),
    cliente,
  };
  // La tarea cierra la base al terminar; aquí solo se cuenta (la prueba la cierra en `afterEach`).
  const cerrar = jest.fn();
  const abrir = jest.fn((): Sesion => ({ ctx: p.ctx, base: { db: p.ctx.db, cerrar } }) as unknown as Sesion);
  return { ...p, cuenta, cliente, deps, cerrar, abrir };
}

async function pareja() {
  const servidor = servidorCompartidoFalso();
  const A = telefono(servidor, 'usuario-a');
  const B = telefono(servidor, 'usuario-b');
  const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
  if (!creado.ok) throw new Error(creado.error);
  const unido = await unirseConQr(B.ctx, B.deps, creado.qr, 'Ana');
  if (!unido.ok) throw new Error(unido.error);
  return { A, B, grupo: creado.grupoId };
}

describe('tarea de gastos compartidos en segundo plano (pendiente 145)', () => {
  it('se define al cargar el módulo con su nombre propio', () => {
    expect(TaskManager.defineTask).toHaveBeenCalledWith(TAREA_COMPARTIDO, expect.any(Function));
    expect(TAREA_COMPARTIDO).not.toBe('finanvoz.respaldo.semanal');
  });

  it('publica lo pendiente de un teléfono y el otro lo descarga sin abrir la app; cierra la base cada vez', async () => {
    const { A, B, grupo } = await pareja();
    A.cliente.red.caida = true;
    agregarGastoCompartido(A.ctx, A.deps, grupo, {
      total: 120000,
      pagueYo: true,
      miParteBp: 5000,
      descripcion: 'Súper',
      categoria: 'super',
      cuentaId: A.cuenta,
    });
    A.cliente.red.caida = false;
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, grupo).pendientes).toBe(1);

    expect(await sincronizarEnSegundoPlano(A.abrir, () => A.deps)).toBe(true);
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, grupo).pendientes).toBe(0);
    expect(await sincronizarEnSegundoPlano(B.abrir, () => B.deps)).toBe(true);
    expect(obtenerGrupoCompartido(B.ctx, B.deps.almacen, grupo).saldo.texto).toBe('Le debes $600 a Ana');
    for (const x of [A, B]) {
      expect(x.abrir).toHaveBeenCalledTimes(1);
      expect(x.cerrar).toHaveBeenCalledTimes(1);
    }
  });

  it('sin red no es una falla: lo pendiente se queda y se intenta en la siguiente corrida', async () => {
    const { A, grupo } = await pareja();
    agregarGastoCompartido(A.ctx, A.deps, grupo, {
      total: 1000,
      pagueYo: true,
      miParteBp: 5000,
      descripcion: '',
      categoria: 'super',
      cuentaId: A.cuenta,
    });
    A.cliente.red.caida = true;
    expect(await sincronizarEnSegundoPlano(A.abrir, () => A.deps)).toBe(true);
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, grupo).pendientes).toBe(1);
    expect(A.cerrar).toHaveBeenCalledTimes(1);
  });

  it('una sesión que el servidor ya no reconoce falla y marca "Volver a vincular"', async () => {
    const { B, grupo } = await pareja();
    const servidor = servidorCompartidoFalso();
    const deps = { ...B.deps, cliente: servidor.cliente('otra-sesion') };
    expect(await sincronizarEnSegundoPlano(B.abrir, () => deps)).toBe(false);
    expect(obtenerGrupoCompartido(B.ctx, B.deps.almacen, grupo).revincular).toBe(true);
  });

  it('si la base no se puede abrir (antes del primer desbloqueo) no lanza: reporta falla', async () => {
    const deps = jest.fn();
    expect(
      await sincronizarEnSegundoPlano(() => {
        throw new Error('sin llave');
      }, deps),
    ).toBe(false);
    expect(deps).not.toHaveBeenCalled();
  });
});

describe('registrar o quitar la tarea', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registra solo si hay un grupo abierto y no estaba registrada', async () => {
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(false);
    await programarSincronizacionCompartido(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(TAREA_COMPARTIDO, {
      minimumInterval: INTERVALO_TAREA_MIN,
    });
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);
    await programarSincronizacionCompartido(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledTimes(1);
    expect(INTERVALO_TAREA_MIN).toBeGreaterThanOrEqual(15);
  });

  it('la quita cuando no queda ningún grupo abierto', async () => {
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);
    await programarSincronizacionCompartido(false);
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_COMPARTIDO);
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(false);
    await programarSincronizacionCompartido(false);
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledTimes(1);
  });

  it('con las tareas restringidas por el sistema no lanza', async () => {
    TaskManager.isTaskRegisteredAsync.mockRejectedValueOnce(new Error('restringido'));
    await expect(programarSincronizacionCompartido(true)).resolves.toBeUndefined();
  });
});
