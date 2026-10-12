import { capturaDisponible, estadoPermiso, leerCola, puenteCaptura, suscribirse } from './puente';

// En jest-expo el módulo nativo no existe: el cargador real (requireOptionalNativeModule)
// devuelve null y el puente degrada sin lanzar, como en Expo Go o iOS.
describe('puente de captura en jest-expo', () => {
  it('no encuentra el módulo y degrada', async () => {
    expect(capturaDisponible()).toBe(false);
    expect(puenteCaptura.esDepuracion()).toBe(false);
    await expect(leerCola()).resolves.toEqual([]);
    await expect(estadoPermiso()).resolves.toBe('no_disponible');
    const cancelar = suscribirse(() => {});
    expect(() => cancelar()).not.toThrow();
  });
});
