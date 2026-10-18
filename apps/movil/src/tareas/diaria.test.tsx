import { AppState } from 'react-native';
import { listarOcurrencias, obtenerHoy } from '../servicios';
import type { Sesion } from '../servicios/sesion';
import { abrirPruebaPantalla, conEscenario } from '../pantallas/principal/__pruebas__/base';
import { abrirDiaEnSegundoPlano } from './diaria';
import { INTERVALO_TAREA_DIARIA_MIN, programarTareaDiaria, TAREA_DIARIA } from './programar';

// Los módulos nativos no existen en jest: la tarea recibe cómo abrir la base y cómo pintar el widget.
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
jest.mock('../widget/actualizar', () => ({ actualizarWidget: jest.fn(async () => {}) }));

const TaskManager = jest.requireMock<{ defineTask: jest.Mock; isTaskRegisteredAsync: jest.Mock }>(
  'expo-task-manager',
);
const BackgroundTask = jest.requireMock<{ registerTaskAsync: jest.Mock; unregisterTaskAsync: jest.Mock }>(
  'expo-background-task',
);
const { abrirSesion } = jest.requireMock<{ abrirSesion: jest.Mock }>('../servicios/sesion');
const { actualizarWidget } = jest.requireMock<{ actualizarWidget: jest.Mock }>('../widget/actualizar');
// La tarea se define al cargar el módulo; `clearAllMocks` borraría la llamada.
const definida = TaskManager.defineTask.mock.calls.find(([nombre]) => nombre === TAREA_DIARIA);

const abiertas: (() => void)[] = [];
afterEach(() => {
  for (const cerrar of abiertas.splice(0)) cerrar();
});

/** La semilla e4-01 (con onboarding) un mes después: hay ocurrencias nuevas por materializar. */
function telefono() {
  const p = conEscenario('e4-01');
  abiertas.push(p.cerrar);
  p.reloj.fijar('2026-11-20');
  // La tarea cierra la base al terminar; aquí solo se cuenta (la prueba la cierra en `afterEach`).
  const cerrar = jest.fn();
  const abrir = jest.fn((): Sesion => ({ ctx: p.ctx, base: { db: p.ctx.db, cerrar } }) as unknown as Sesion);
  return { ...p, cerrar, abrir };
}

const enSegundoPlano = () => false;

describe('apertura del día en segundo plano (pendiente 63)', () => {
  it('se define al cargar el módulo con su nombre propio', () => {
    expect(definida).toBeDefined();
    expect(TAREA_DIARIA).not.toBe('finanvoz.respaldo.semanal');
    expect(TAREA_DIARIA).not.toBe('finanvoz.compartido.sincronizar');
  });

  it('corre la apertura y repinta el widget con la cifra del día; cierra la base antes de pintar', async () => {
    const t = telefono();
    const antes = listarOcurrencias(t.ctx).length;
    const repintar = jest.fn(async () => {
      expect(t.cerrar).toHaveBeenCalledTimes(1);
    });
    expect(await abrirDiaEnSegundoPlano(t.abrir, repintar, enSegundoPlano)).toBe(true);
    expect(listarOcurrencias(t.ctx).length).toBeGreaterThan(antes);
    expect(repintar).toHaveBeenCalledTimes(1);
    expect(repintar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'cifra' }));
  });

  it('es idempotente: dos corridas el mismo día y la apertura en primer plano no duplican nada', async () => {
    const t = telefono();
    const repintar = jest.fn(async () => {});
    await abrirDiaEnSegundoPlano(t.abrir, repintar, enSegundoPlano);
    const ocurrencias = listarOcurrencias(t.ctx);
    const hoy = obtenerHoy(t.ctx);
    await abrirDiaEnSegundoPlano(t.abrir, repintar, enSegundoPlano);
    expect(listarOcurrencias(t.ctx)).toEqual(ocurrencias);
    expect(obtenerHoy(t.ctx)).toEqual(hoy);
    expect(repintar.mock.calls[1]).toEqual(repintar.mock.calls[0]);
    expect(t.ctx.libro.comprobarIntegridad()).toEqual([]);
    expect(t.cerrar).toHaveBeenCalledTimes(2);
  });

  it('con la app en primer plano no abre otra conexión: Hoy ya corre la apertura', async () => {
    const t = telefono();
    const repintar = jest.fn(async () => {});
    expect(await abrirDiaEnSegundoPlano(t.abrir, repintar, () => true)).toBe(true);
    expect(t.abrir).not.toHaveBeenCalled();
    expect(repintar).not.toHaveBeenCalled();
  });

  it('antes del consentimiento no escribe nada y el widget invita a empezar', async () => {
    const p = abrirPruebaPantalla('2026-10-11');
    abiertas.push(p.cerrar);
    const abrir = (): Sesion =>
      ({ ctx: p.ctx, base: { db: p.ctx.db, cerrar: jest.fn() } }) as unknown as Sesion;
    const repintar = jest.fn(async () => {});
    expect(await abrirDiaEnSegundoPlano(abrir, repintar, enSegundoPlano)).toBe(true);
    expect(listarOcurrencias(p.ctx)).toEqual([]);
    expect(repintar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'Toca para empezar' }));
  });

  it('si la base no se puede abrir (antes del primer desbloqueo) no lanza ni pinta: reporta falla', async () => {
    const repintar = jest.fn(async () => {});
    expect(
      await abrirDiaEnSegundoPlano(
        () => {
          throw new Error('sin llave');
        },
        repintar,
        enSegundoPlano,
      ),
    ).toBe(false);
    expect(repintar).not.toHaveBeenCalled();
  });

  it('la tarea registrada abre la sesión del teléfono, corre la apertura y repinta el widget', async () => {
    const t = telefono();
    abrirSesion.mockImplementation(t.abrir);
    // Como al despertar con el teléfono bloqueado: la app no está en primer plano.
    expect(AppState.currentState).not.toBe('active');
    const tarea = definida?.[1] as () => Promise<number>;
    expect(await tarea()).toBe(1);
    expect(abrirSesion).toHaveBeenCalledTimes(1);
    expect(actualizarWidget).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'cifra' }));
    abrirSesion.mockImplementation(() => {
      throw new Error('sin llave');
    });
    expect(await tarea()).toBe(2);
  });
});

describe('registrar la tarea diaria', () => {
  beforeEach(() => jest.clearAllMocks());

  it('se registra una sola vez', async () => {
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(false);
    await programarTareaDiaria(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(TAREA_DIARIA, {
      minimumInterval: INTERVALO_TAREA_DIARIA_MIN,
    });
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);
    await programarTareaDiaria(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledTimes(1);
    expect(INTERVALO_TAREA_DIARIA_MIN).toBeGreaterThanOrEqual(15);
    expect(INTERVALO_TAREA_DIARIA_MIN).toBeLessThanOrEqual(24 * 60);
  });

  it('se puede quitar', async () => {
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);
    await programarTareaDiaria(false);
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_DIARIA);
  });

  it('con las tareas restringidas por el sistema no lanza', async () => {
    TaskManager.isTaskRegisteredAsync.mockRejectedValueOnce(new Error('restringido'));
    await expect(programarTareaDiaria(true)).resolves.toBeUndefined();
  });
});
