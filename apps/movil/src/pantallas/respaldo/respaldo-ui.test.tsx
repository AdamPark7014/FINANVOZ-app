import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Contexto } from '../../servicios';
import { ProveedorControlApp, type ControlApp } from '../../sesion/ControlApp';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { ProveedorPlan } from '../../suscripciones/ProveedorPlan';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { fijarContrasenaRespaldo, obtenerRespaldoNube } from '../../servicios';
import { crearSesionPrueba } from '../onboarding/__pruebas__/sesion';
import { PantallaRespaldo } from './PantallaRespaldo';
import { Restaurar } from './Restaurar';
import { TarjetaRespaldo } from './TarjetaRespaldo';
import { crearRespaldoPrueba } from './__pruebas__/respaldo';
import {
  ACCESIBILIDAD_VOLVER,
  ACCESIBILIDAD_VOLVER_RESTAURAR,
  AVISO_CONTRASENA,
  BTN_CREAR_CONTRASENA,
  BTN_RESTAURAR_RESPALDO,
  DESCRIPCION_ARCHIVO,
  MENSAJE_ARCHIVO_COMPARTIDO,
  PISTA_BORRAR_CUENTA,
  PISTA_CAMBIAR_CONTRASENA,
  PISTA_CONFIRMAR_BORRAR_CUENTA,
  PISTA_CANCELAR_CONTRASENA,
  PISTA_CREAR_CONTRASENA,
  PISTA_EXPORTAR_ARCHIVO,
  PISTA_GUARDAR_CONTRASENA,
  PISTA_RESTAURAR_ELEGIR_ARCHIVO,
  PISTA_RESTAURAR_RESPALDO,
  PISTA_RESPALDAR_AHORA,
  PISTA_VOLVER,
  PISTA_VOLVER_RESTAURAR,
  SUBTITULO_ARCHIVO,
  TITULO_RESPALDO,
  TITULO_RESTAURAR,
} from './textos';

function montar(ctx: Contexto, ui: ReactNode, control: ControlApp) {
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

describe('textos de respaldo (`02 §14`, §19)', () => {
  it('la UI fija en textos.ts no lleva exclamaciones', () => {
    const ui = [
      TITULO_RESPALDO,
      SUBTITULO_ARCHIVO,
      DESCRIPCION_ARCHIVO,
      AVISO_CONTRASENA,
      BTN_CREAR_CONTRASENA,
      BTN_RESTAURAR_RESPALDO,
      PISTA_VOLVER,
      PISTA_BORRAR_CUENTA,
      PISTA_CONFIRMAR_BORRAR_CUENTA,
      PISTA_CREAR_CONTRASENA,
      PISTA_CAMBIAR_CONTRASENA,
      PISTA_RESTAURAR_RESPALDO,
      PISTA_RESPALDAR_AHORA,
      PISTA_EXPORTAR_ARCHIVO,
      PISTA_GUARDAR_CONTRASENA,
      PISTA_CANCELAR_CONTRASENA,
    ].join('\n');
    expect(ui).not.toMatch(/[!¡]/);
  });
});

describe('accesibilidad en pantalla respaldo', () => {
  it('volver y acciones del archivo tienen rol y etiqueta hablada', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(p.ctx, <PantallaRespaldo alVolver={jest.fn()} alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(screen.getByTestId('respaldo-volver')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('respaldo-volver')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_VOLVER);
    expect(screen.getByTestId('respaldo-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
    expect(screen.getByTestId('respaldo-titulo')).toHaveTextContent(TITULO_RESPALDO);
    expect(screen.getByTestId('respaldo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('privacidad-respaldo-crear')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('privacidad-respaldo-crear')).toHaveProp(
      'accessibilityHint',
      PISTA_CREAR_CONTRASENA,
    );
    expect(screen.getByTestId('privacidad-respaldo-restaurar')).toHaveProp(
      'accessibilityLabel',
      BTN_RESTAURAR_RESPALDO,
    );
    expect(screen.getByTestId('privacidad-respaldo-restaurar')).toHaveProp(
      'accessibilityHint',
      PISTA_RESTAURAR_RESPALDO,
    );
    p.cerrar();
  });

  it('exportar archivo tiene pista TalkBack', async () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    const contrasena = 'mi frase de respaldo segura';
    await fijarContrasenaRespaldo(r.deps, contrasena, contrasena);
    montar(p.ctx, <TarjetaRespaldo alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(screen.getByTestId('privacidad-respaldo-exportar')).toHaveProp(
      'accessibilityHint',
      PISTA_EXPORTAR_ARCHIVO,
    );
    p.cerrar();
  }, 15_000);

  it('formulario contraseña: aviso alert y pistas TalkBack en guardar y cancelar', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(p.ctx, <TarjetaRespaldo alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    fireEvent.press(screen.getByTestId('privacidad-respaldo-crear'));
    expect(screen.getByTestId('respaldo-aviso-contrasena')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByTestId('respaldo-contrasena-guardar')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_CONTRASENA,
    );
    expect(screen.getByTestId('respaldo-contrasena-cancelar')).toHaveProp(
      'accessibilityHint',
      PISTA_CANCELAR_CONTRASENA,
    );
    p.cerrar();
  });

  it('TarjetaRespaldo muestra copy centralizado antes de crear contraseña', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(p.ctx, <TarjetaRespaldo alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(screen.getByTestId('privacidad-respaldo-titulo')).toHaveTextContent(SUBTITULO_ARCHIVO);
    expect(screen.getByTestId('privacidad-respaldo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(DESCRIPCION_ARCHIVO)).toBeTruthy();
    p.cerrar();
  });

  it('TarjetaRespaldo con contraseña: cambiar tiene pista TalkBack', async () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    const contrasena = 'mi frase de respaldo segura';
    await fijarContrasenaRespaldo(r.deps, contrasena, contrasena);
    montar(p.ctx, <TarjetaRespaldo alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(screen.getByTestId('privacidad-respaldo-cambiar')).toHaveProp(
      'accessibilityHint',
      PISTA_CAMBIAR_CONTRASENA,
    );
    p.cerrar();
  }, 15_000);

  it('Restaurar: volver y elegir archivo tienen pista TalkBack', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(p.ctx, <Restaurar alVolver={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(screen.getByTestId('restaurar-volver')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('restaurar-volver')).toHaveProp(
      'accessibilityLabel',
      ACCESIBILIDAD_VOLVER_RESTAURAR,
    );
    expect(screen.getByTestId('restaurar-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_RESTAURAR);
    expect(screen.getByTestId('restaurar-titulo')).toHaveTextContent(TITULO_RESTAURAR);
    expect(screen.getByTestId('restaurar-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('restaurar-elegir')).toHaveProp(
      'accessibilityHint',
      PISTA_RESTAURAR_ELEGIR_ARCHIVO,
    );
    p.cerrar();
  });
});

describe('respaldo en iPhone (auditoría de botones)', () => {
  it('exportar el archivo guarda la fecha y, al cerrar la hoja de compartir, dice dónde queda', async () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    const contrasena = 'mi frase de respaldo segura';
    await fijarContrasenaRespaldo(r.deps, contrasena, contrasena);
    montar(p.ctx, <TarjetaRespaldo alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(obtenerRespaldoNube(p.ctx).ultimoArchivo).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('privacidad-respaldo-exportar'));
    });
    expect(r.archivos.compartir).toHaveBeenCalledTimes(1);
    expect(obtenerRespaldoNube(p.ctx).ultimoArchivo).toBe('2026-10-11');
    expect(screen.getByTestId('privacidad-respaldo-mensaje')).toHaveTextContent(MENSAJE_ARCHIVO_COMPARTIDO);
    p.cerrar();
  }, 30_000);

  it('Restaurar: con la contraseña vacía el retorno no hace nada y «Elegir otro archivo» abre el selector', async () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    r.archivos.elegir.mockResolvedValue(new Uint8Array([1, 2, 3]));
    montar(p.ctx, <Restaurar alVolver={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('restaurar-elegir'));
    });
    expect(r.archivos.elegir).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent(screen.getByTestId('restaurar-contrasena'), 'submitEditing');
    });
    // Sin contraseña no intentó abrir: ni error ni cambio de paso.
    expect(screen.queryByTestId('restaurar-error')).toBeNull();
    expect(screen.getByTestId('restaurar-contrasena')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('restaurar-otro'));
    });
    expect(r.archivos.elegir).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('restaurar-contrasena')).toBeTruthy();
    p.cerrar();
  });

  it('sin nube, Respaldo dice el último archivo exportado o invita a exportar uno', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(p.ctx, <PantallaRespaldo alVolver={jest.fn()} alRestaurar={jest.fn()} />, {
      borrarTodo: async () => {},
      respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} },
    });
    expect(screen.getByTestId('respaldo-ultimo')).toHaveTextContent(
      'Todavía no tienes respaldos. Exporta un archivo y guárdalo fuera del teléfono.',
    );
    p.cerrar();
  });
});
