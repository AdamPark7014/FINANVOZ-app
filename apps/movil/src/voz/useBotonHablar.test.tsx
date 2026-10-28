import { renderHook } from '@testing-library/react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { REBOTE_MS, UMBRAL_MANTENER_MS, useBotonHablar } from './useBotonHablar';

const accion = (actionName: string) => ({ nativeEvent: { actionName } }) as AccessibilityActionEvent;

/** El botón con reloj manual; `escuchar(v)` simula que el dictado cambió de estado. */
function montar() {
  let t = 10_000;
  const iniciar = jest.fn();
  const detener = jest.fn();
  const { result, rerender } = renderHook(
    ({ escuchando }: { escuchando: boolean }) => useBotonHablar({ escuchando, iniciar, detener }, () => t),
    { initialProps: { escuchando: false } },
  );
  return {
    boton: () => result.current,
    escuchar: (escuchando: boolean) => rerender({ escuchando }),
    avanzar: (ms: number) => {
      t += ms;
    },
    iniciar,
    detener,
  };
}

describe('useBotonHablar', () => {
  it('toca para hablar: un toque corto empieza y sigue escuchando al soltar', () => {
    const b = montar();
    b.boton().alPresionarDentro();
    expect(b.iniciar).toHaveBeenCalledTimes(1);
    b.escuchar(true);
    b.avanzar(120);
    b.boton().alSoltar();
    expect(b.detener).not.toHaveBeenCalled();
  });

  it('toca para terminar: otro toque mientras escucha termina', () => {
    const b = montar();
    b.boton().alPresionarDentro();
    b.avanzar(100);
    b.boton().alSoltar();
    b.escuchar(true);
    b.avanzar(2_000);
    b.boton().alPresionarDentro();
    expect(b.detener).not.toHaveBeenCalled();
    b.avanzar(100);
    b.boton().alSoltar();
    expect(b.detener).toHaveBeenCalledTimes(1);
    expect(b.iniciar).toHaveBeenCalledTimes(1);
  });

  it('mantener presionado sigue funcionando: al soltar termina', () => {
    const b = montar();
    b.boton().alPresionarDentro();
    b.escuchar(true);
    b.avanzar(UMBRAL_MANTENER_MS);
    b.boton().alSoltar();
    expect(b.iniciar).toHaveBeenCalledTimes(1);
    expect(b.detener).toHaveBeenCalledTimes(1);
  });

  it('TalkBack: la acción "activar" alterna entre empezar y terminar', () => {
    const b = montar();
    expect(b.boton().accionesAccesibles).toEqual([{ name: 'activate' }]);
    b.boton().alAccionAccesible(accion('activate'));
    expect(b.iniciar).toHaveBeenCalledTimes(1);
    b.escuchar(true);
    b.avanzar(3_000);
    b.boton().alAccionAccesible(accion('activate'));
    expect(b.detener).toHaveBeenCalledTimes(1);
    b.boton().alAccionAccesible(accion('longpress'));
    expect(b.iniciar).toHaveBeenCalledTimes(1);
    expect(b.detener).toHaveBeenCalledTimes(1);
  });

  it('un doble toque de TalkBack que llega como toque y como "activar" no empieza y termina al instante', () => {
    const b = montar();
    b.boton().alPresionarDentro();
    b.avanzar(20);
    b.boton().alSoltar();
    b.escuchar(true);
    b.avanzar(REBOTE_MS - 50);
    b.boton().alAccionAccesible(accion('activate'));
    expect(b.iniciar).toHaveBeenCalledTimes(1);
    expect(b.detener).not.toHaveBeenCalled();

    // Al revés: "activar" primero y el toque simulado detrás.
    const c = montar();
    c.boton().alAccionAccesible(accion('activate'));
    c.escuchar(true);
    c.avanzar(10);
    c.boton().alPresionarDentro();
    c.avanzar(30);
    c.boton().alSoltar();
    expect(c.iniciar).toHaveBeenCalledTimes(1);
    expect(c.detener).not.toHaveBeenCalled();
  });
});

describe('useBotonHablar · deslizar para cancelar (B+, D2)', () => {
  function conCancelar() {
    let t = 10_000;
    const iniciar = jest.fn();
    const detener = jest.fn();
    const cancelar = jest.fn();
    const { result, rerender } = renderHook(
      ({ escuchando }: { escuchando: boolean }) =>
        useBotonHablar({ escuchando, iniciar, detener, cancelar }, () => t),
      { initialProps: { escuchando: false } },
    );
    return {
      boton: () => result.current,
      escuchar: (escuchando: boolean) => rerender({ escuchando }),
      avanzar: (ms: number) => {
        t += ms;
      },
      iniciar,
      detener,
      cancelar,
    };
  }

  it('mantener y deslizar fuera descarta lo dicho (no lo termina)', () => {
    const b = conCancelar();
    b.boton().alPresionarDentro();
    b.escuchar(true);
    b.avanzar(UMBRAL_MANTENER_MS + 200);
    b.boton().alDeslizarFuera();
    expect(b.cancelar).toHaveBeenCalledTimes(1);
    expect(b.detener).not.toHaveBeenCalled();
  });

  it('un toque que vuelve sobre el micrófono mientras escucha no cancela al deslizar (para eso está la X)', () => {
    const b = conCancelar();
    b.boton().alPresionarDentro();
    b.escuchar(true);
    b.avanzar(100);
    b.boton().alSoltar();
    b.avanzar(REBOTE_MS + 500);
    b.boton().alPresionarDentro();
    b.boton().alDeslizarFuera();
    expect(b.cancelar).not.toHaveBeenCalled();
    expect(b.detener).not.toHaveBeenCalled();
  });
});
