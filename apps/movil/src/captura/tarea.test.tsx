import { createHash } from 'node:crypto';
import type { PuenteCaptura } from './tipos';
import { INTERVALO_TAREA_MIN, programarTareaCaptura, TAREA_CAPTURA } from './programar';
import { dependenciasTareaCaptura, procesarCapturaEnSegundoPlano } from './tarea';
import { publicadorEnMemoria } from './aviso-capturas';
import { aceptarConsentimiento, activarCaptura } from '../servicios';
import type { Sesion } from '../servicios/sesion';
import { abrirPruebaPantalla } from '../pantallas/principal/__pruebas__/base';

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

const TaskManager = jest.requireMock<{ defineTask: jest.Mock; isTaskRegisteredAsync: jest.Mock }>(
  'expo-task-manager',
);
const BackgroundTask = jest.requireMock<{ registerTaskAsync: jest.Mock; unregisterTaskAsync: jest.Mock }>(
  'expo-background-task',
);

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const abiertas: (() => void)[] = [];
afterEach(() => {
  for (const cerrar of abiertas.splice(0)) cerrar();
});

function puenteVacio(): PuenteCaptura {
  return {
    disponible: () => true,
    esDepuracion: () => true,
    leerCola: jest.fn(async () => []),
    confirmarProcesadas: jest.fn(async () => 0),
    suscribirse: jest.fn(() => () => {}),
    estadoPermiso: jest.fn(async () => 'concedido'),
    appsBancariasInstaladas: jest.fn(async () => []),
    ultimoEvento: jest.fn(async () => null),
    fijarListaBlanca: jest.fn(async () => true),
    fijarCatalogoRemoto: jest.fn(async () => true),
  } as unknown as PuenteCaptura;
}

describe('tarea de captura en segundo plano (pendiente 16)', () => {
  it('se define al cargar el módulo con su nombre propio', () => {
    expect(TaskManager.defineTask).toHaveBeenCalledWith(TAREA_CAPTURA, expect.any(Function));
    expect(TAREA_CAPTURA).toBe('finanvoz.captura.procesar');
  });

  it('sin puente no es falla', async () => {
    expect(
      await procesarCapturaEnSegundoPlano(
        () => {
          throw new Error('no debería abrir');
        },
        () => ({ puente: null, opciones: {} as never, publicador: null }),
      ),
    ).toBe(true);
  });

  it('procesa la cola, cierra la base y no avisa en vacío', async () => {
    const p = abrirPruebaPantalla('2026-10-11');
    abiertas.push(p.cerrar);
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    const pub = publicadorEnMemoria();
    const puente = puenteVacio();
    const cerrar = jest.fn();
    const abrir = jest.fn((): Sesion => ({ ctx: p.ctx, base: { db: p.ctx.db, cerrar } }) as unknown as Sesion);
    expect(
      await procesarCapturaEnSegundoPlano(abrir, () => ({
        puente,
        opciones: { catalogo: dependenciasTareaCaptura().opciones.catalogo, sha256, depuracion: true },
        publicador: pub,
      })),
    ).toBe(true);
    expect(puente.leerCola).toHaveBeenCalled();
    expect(pub.cuerpos()).toEqual([]);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(cerrar).toHaveBeenCalledTimes(1);
  });
});

describe('registrar o quitar la tarea de captura', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registra solo si la captura está activa y no estaba registrada', async () => {
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(false);
    await programarTareaCaptura(true);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(TAREA_CAPTURA, {
      minimumInterval: INTERVALO_TAREA_MIN,
    });
    expect(INTERVALO_TAREA_MIN).toBeGreaterThanOrEqual(15);
  });

  it('la quita cuando la captura se apaga', async () => {
    TaskManager.isTaskRegisteredAsync.mockResolvedValueOnce(true);
    await programarTareaCaptura(false);
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_CAPTURA);
  });
});
