import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./puente-nativo', () => ({ cargarModuloNativo: () => null }));

import {
  aNotificacionCruda,
  crearPuente,
  leerCola,
  estadoPermiso,
  suscribirse,
  type ModuloCapturaNativo,
  type NotificacionCruda,
} from './puente';

const N01: NotificacionCruda = {
  clave: '0|com.android.shell|2020|banco_a|2000',
  etiqueta: 'banco_a',
  paquete: 'mx.ejemplo.bancoa',
  titulo: 'Compra con tu tarjeta',
  texto: 'Compraste $250.00 en OXXO PUEBLA 123 con tu tarjeta ***5521.',
  publicada_en: 1_791_734_400_000,
  cuando: 1_791_734_400_000,
};

/** Módulo nativo falso: una cola en memoria con la semántica de `Cola.kt`. */
function crearNativoFalso(inicial: unknown[] = []) {
  let cola = [...inicial];
  const oyentes = new Set<(n: unknown) => void>();
  const identidad = (n: Record<string, unknown>) =>
    JSON.stringify([n.paquete, n.clave, n.cuando, n.titulo, n.texto]);
  const nativo = {
    depuracion: true,
    leerCola: vi.fn(async () => [...cola]),
    confirmarProcesadas: vi.fn(async (procesadas: NotificacionCruda[]) => {
      const ids = new Set(procesadas.map((p) => identidad({ ...p })));
      const antes = cola.length;
      cola = cola.filter((n) => !ids.has(identidad(n as Record<string, unknown>)));
      return antes - cola.length;
    }),
    estadoPermiso: vi.fn(async () => 'concedido'),
    abrirAjustesPermiso: vi.fn(async () => true),
    abrirInfoApp: vi.fn(async () => true),
    appsBancariasInstaladas: vi.fn(async (): Promise<unknown[]> => [
      { banco: 'nu_mx', nombre: 'Nu México', paquete: 'com.nu.production' },
      { banco: 'roto' },
    ]),
    fijarListaBlanca: vi.fn(async (p: string[]) => p.filter((x) => x !== 'com.whatsapp')),
    listaBlanca: vi.fn(async () => ['com.nu.production']),
    ultimoEvento: vi.fn(async (): Promise<number | null> => 1_791_734_400_000),
    estadoServicio: vi.fn(async (): Promise<unknown> => ({
      conectado_en: 1,
      desconectado_en: null,
      ultimo_evento: 2,
    })),
    solicitarReconexion: vi.fn(async () => {}),
    diagnosticoResumen: vi.fn(async (): Promise<unknown> => ({
      activo: true,
      muestras: false,
      permite_muestras: true,
      desde: 5,
      no_autorizadas: 3,
      paquetes: {
        'com.nu.production': {
          recibidas: 2,
          encoladas: 1,
          largo_texto: { '1-80': 1 },
          extras: { 'android.text': 2 },
        },
      },
    })),
    diagnosticoConfigurar: vi.fn(async (): Promise<unknown> => ({ basura: true })),
    diagnosticoMuestras: vi.fn(async (): Promise<unknown[]> => [
      { paquete: 'mx.ejemplo.bancoa', etiqueta: null, titulo: 't', texto: 'x', cuando: 1 },
      { paquete: 1 },
    ]),
    diagnosticoBorrar: vi.fn(async () => {}),
    addListener: vi.fn((_evento: 'notificacion', oyente: (n: unknown) => void) => {
      oyentes.add(oyente);
      return { remove: () => oyentes.delete(oyente) };
    }),
  } satisfies ModuloCapturaNativo;
  const emitir = (n: unknown) => oyentes.forEach((o) => o(n));
  return { nativo, emitir, oyentes, cola: () => cola };
}

describe('puente de captura con el módulo nativo', () => {
  let falso: ReturnType<typeof crearNativoFalso>;
  beforeEach(() => {
    falso = crearNativoFalso();
  });

  it('carga el módulo una sola vez y reporta que está disponible', async () => {
    const cargar = vi.fn(() => falso.nativo);
    const p = crearPuente(cargar);
    expect(p.disponible()).toBe(true);
    expect(p.esDepuracion()).toBe(true);
    await p.leerCola();
    await p.estadoPermiso();
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('leerCola entrega exactamente los siete campos y omite entradas inválidas', async () => {
    const sinEtiqueta = { ...N01, clave: 'k2', etiqueta: undefined };
    falso = crearNativoFalso([
      { ...N01, extra: 'se ignora' },
      sinEtiqueta,
      { ...N01, cuando: 1.5 },
      { clave: 'x' },
      null,
    ]);
    const cola = await crearPuente(() => falso.nativo).leerCola();
    expect(cola).toEqual([N01, { ...N01, clave: 'k2', etiqueta: null }]);
    expect(Object.keys(cola[0] ?? {}).sort()).toEqual(
      ['clave', 'cuando', 'etiqueta', 'paquete', 'publicada_en', 'texto', 'titulo'].sort(),
    );
  });

  it('confirmarProcesadas quita solo lo ingerido, aunque llegue otra con la misma clave', async () => {
    falso = crearNativoFalso([N01]);
    const p = crearPuente(() => falso.nativo);
    const leidas = await p.leerCola();
    const otraCompra = { ...N01, cuando: N01.cuando + 60_000, publicada_en: N01.publicada_en + 60_000 };
    falso.cola().push(otraCompra);
    expect(await p.confirmarProcesadas(leidas)).toBe(1);
    expect(await p.leerCola()).toEqual([otraCompra]);
    expect(await p.confirmarProcesadas([])).toBe(0);
    expect(falso.nativo.confirmarProcesadas).toHaveBeenCalledTimes(1);
  });

  it('confirmarProcesadas manda solo los siete campos', async () => {
    const p = crearPuente(() => falso.nativo);
    await p.confirmarProcesadas([{ ...N01, huella: 'abc' } as NotificacionCruda]);
    expect(falso.nativo.confirmarProcesadas).toHaveBeenCalledWith([N01]);
  });

  it('suscribirse entrega notificaciones válidas y se cancela', () => {
    const p = crearPuente(() => falso.nativo);
    const recibidas: NotificacionCruda[] = [];
    const cancelar = p.suscribirse((n) => recibidas.push(n));
    falso.emitir(N01);
    falso.emitir({ basura: true });
    expect(recibidas).toEqual([N01]);
    cancelar();
    expect(falso.oyentes.size).toBe(0);
    falso.emitir(N01);
    expect(recibidas).toHaveLength(1);
  });

  it('permiso, ajustes, apps, lista blanca, último evento y reconexión', async () => {
    const p = crearPuente(() => falso.nativo);
    expect(await p.estadoPermiso()).toBe('concedido');
    falso.nativo.estadoPermiso.mockResolvedValueOnce('otra cosa');
    expect(await p.estadoPermiso()).toBe('denegado');
    expect(await p.abrirAjustesPermiso()).toBe(true);
    expect(await p.abrirInfoApp()).toBe(true);
    expect(await p.appsBancariasInstaladas()).toEqual([
      { banco: 'nu_mx', nombre: 'Nu México', paquete: 'com.nu.production' },
    ]);
    expect(await p.fijarListaBlanca(['com.nu.production', 'com.nu.production', 'com.whatsapp'])).toEqual([
      'com.nu.production',
    ]);
    expect(falso.nativo.fijarListaBlanca).toHaveBeenCalledWith(['com.nu.production', 'com.whatsapp']);
    expect(await p.listaBlanca()).toEqual(['com.nu.production']);
    expect(await p.ultimoEvento()).toBe(1_791_734_400_000);
    falso.nativo.ultimoEvento.mockResolvedValueOnce(null);
    expect(await p.ultimoEvento()).toBeNull();
    expect(await p.estadoServicio()).toEqual({ conectado_en: 1, desconectado_en: null, ultimo_evento: 2 });
    await p.solicitarReconexion();
    expect(falso.nativo.solicitarReconexion).toHaveBeenCalled();
  });

  it('diagnóstico: resumen validado, respuesta inválida como vacío y muestras filtradas', async () => {
    const p = crearPuente(() => falso.nativo);
    const r = await p.diagnostico.resumen();
    expect(r.no_autorizadas).toBe(3);
    expect(r.paquetes['com.nu.production']?.encoladas).toBe(1);
    expect(r.paquetes['com.nu.production']?.largo_texto).toEqual({ '1-80': 1 });
    const c = await p.diagnostico.configurar({ activo: true });
    expect(falso.nativo.diagnosticoConfigurar).toHaveBeenCalledWith(true, false);
    expect(c.activo).toBe(false);
    expect(await p.diagnostico.muestras()).toEqual([
      { paquete: 'mx.ejemplo.bancoa', etiqueta: null, titulo: 't', texto: 'x', cuando: 1 },
    ]);
    await p.diagnostico.borrar();
    expect(falso.nativo.diagnosticoBorrar).toHaveBeenCalled();
  });

  it('los errores del módulo nativo se propagan para reintentar', async () => {
    falso.nativo.leerCola.mockRejectedValueOnce(new Error('E/S'));
    await expect(crearPuente(() => falso.nativo).leerCola()).rejects.toThrow('E/S');
  });

  it('aNotificacionCruda valida la forma', () => {
    expect(aNotificacionCruda(N01)).toEqual(N01);
    expect(aNotificacionCruda({ ...N01, clave: '' })).toBeNull();
    expect(aNotificacionCruda({ ...N01, publicada_en: -1 })).toBeNull();
  });
});

describe('catálogo remoto en el módulo nativo (M10, 07 §3.1)', () => {
  const bancos = [{ id: 'banco_a', nombre: 'Banco A', paquetes_android: ['mx.ejemplo.bancoa'] }];

  it('pasa los bancos verificados como JSON `{bancos}` y `null` para quitarlos', async () => {
    const fijar = vi.fn(async (json: string | null) => (json ? 1 : 0));
    const p = crearPuente(() => ({ ...crearNativoFalso().nativo, fijarCatalogoRemoto: fijar }));
    expect(await p.fijarCatalogoRemoto(bancos)).toBe(true);
    expect(JSON.parse(fijar.mock.calls[0]?.[0] ?? 'null')).toEqual({ bancos });
    expect(await p.fijarCatalogoRemoto(null)).toBe(true);
    expect(fijar).toHaveBeenLastCalledWith(null);
  });

  it('un build anterior a M10 (sin la función) no falla', async () => {
    const p = crearPuente(() => crearNativoFalso().nativo);
    expect(await p.fijarCatalogoRemoto(bancos)).toBe(false);
  });
});

describe('puente de captura sin módulo nativo (Jest, Expo Go, iOS)', () => {
  it('degrada sin lanzar', async () => {
    const p = crearPuente(() => null);
    expect(p.disponible()).toBe(false);
    expect(p.esDepuracion()).toBe(false);
    expect(await p.leerCola()).toEqual([]);
    expect(await p.confirmarProcesadas([N01])).toBe(0);
    expect(await p.estadoPermiso()).toBe('no_disponible');
    expect(await p.abrirAjustesPermiso()).toBe(false);
    expect(await p.abrirInfoApp()).toBe(false);
    expect(await p.appsBancariasInstaladas()).toEqual([]);
    expect(await p.fijarListaBlanca(['com.nu.production'])).toEqual([]);
    expect(await p.listaBlanca()).toEqual([]);
    expect(await p.ultimoEvento()).toBeNull();
    expect(await p.estadoServicio()).toEqual({
      conectado_en: null,
      desconectado_en: null,
      ultimo_evento: null,
    });
    await expect(p.solicitarReconexion()).resolves.toBeUndefined();
    expect(await p.fijarCatalogoRemoto([])).toBe(false);
    expect((await p.diagnostico.resumen()).activo).toBe(false);
    expect(await p.diagnostico.muestras()).toEqual([]);
    const cancelar = p.suscribirse(() => {});
    expect(() => cancelar()).not.toThrow();
  });

  it('las funciones exportadas usan el cargador real, que aquí no encuentra el módulo', async () => {
    expect(await leerCola()).toEqual([]);
    expect(await estadoPermiso()).toBe('no_disponible');
    expect(typeof suscribirse(() => {})).toBe('function');
  });
});
