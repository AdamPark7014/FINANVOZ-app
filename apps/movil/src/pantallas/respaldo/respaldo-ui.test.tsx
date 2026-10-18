import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Contexto } from '../../servicios';
import { ProveedorControlApp, type ControlApp } from '../../sesion/ControlApp';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { ProveedorPlan } from '../../suscripciones/ProveedorPlan';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { fijarContrasenaRespaldo } from '../../servicios';
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
  PISTA_BORRAR_CUENTA,
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
      PISTA_RESPALDAR_AHORA,
    ].join('\n');
    expect(ui).not.toMatch(/[!¡]/);
  });
});

describe('accesibilidad en pantalla respaldo', () => {
  it('volver y acciones del archivo tienen rol y etiqueta hablada', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(
      p.ctx,
      <PantallaRespaldo alVolver={jest.fn()} alRestaurar={jest.fn()} />,
      { borrarTodo: async () => {}, respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} } },
    );
    expect(screen.getByTestId('respaldo-volver')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('respaldo-volver')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_VOLVER);
    expect(screen.getByTestId('respaldo-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
    expect(screen.getByTestId('respaldo-titulo')).toHaveTextContent(TITULO_RESPALDO);
    expect(screen.getByTestId('respaldo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('privacidad-respaldo-crear')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('privacidad-respaldo-restaurar')).toHaveProp(
      'accessibilityLabel',
      BTN_RESTAURAR_RESPALDO,
    );
    p.cerrar();
  });

  it('TarjetaRespaldo muestra copy centralizado antes de crear contraseña', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(
      p.ctx,
      <TarjetaRespaldo alRestaurar={jest.fn()} />,
      { borrarTodo: async () => {}, respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} } },
    );
    expect(screen.getByTestId('privacidad-respaldo-titulo')).toHaveTextContent(SUBTITULO_ARCHIVO);
    expect(screen.getByTestId('privacidad-respaldo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(DESCRIPCION_ARCHIVO)).toBeTruthy();
    p.cerrar();
  });

  it('Restaurar: volver tiene rol, etiqueta y pista', () => {
    const p = crearSesionPrueba('2026-10-11');
    const r = crearRespaldoPrueba();
    montar(
      p.ctx,
      <Restaurar alVolver={jest.fn()} />,
      { borrarTodo: async () => {}, respaldo: { deps: r.deps, archivos: r.archivos, restaurar: async () => {} } },
    );
    expect(screen.getByTestId('restaurar-volver')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('restaurar-volver')).toHaveProp(
      'accessibilityLabel',
      ACCESIBILIDAD_VOLVER_RESTAURAR,
    );
    expect(screen.getByTestId('restaurar-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_RESTAURAR);
    expect(screen.getByTestId('restaurar-titulo')).toHaveTextContent(TITULO_RESTAURAR);
    expect(screen.getByTestId('restaurar-titulo')).toHaveProp('accessibilityRole', 'header');
    p.cerrar();
  });
});
