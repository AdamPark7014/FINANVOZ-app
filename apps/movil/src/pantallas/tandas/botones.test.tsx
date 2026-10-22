import { fireEvent, screen } from '@testing-library/react-native';
import type { PlainDate } from '@cartera/core';
import {
  aceptarConsentimiento,
  agregarCuenta,
  crearTanda,
  detalleTanda,
  reglaDeFrecuencia,
} from '../../servicios';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { fechasCercanas } from './FormularioTanda';
import { PantallaTanda } from './PantallaTanda';
import { PantallaTandas } from './PantallaTandas';
import { ERROR_FECHA_INICIO, MARCA_FECHA_INVALIDA, PISTA_CANCELAR_APORTACION } from './textos';

function preparar(hoy: PlainDate) {
  const p = abrirPruebaPantalla(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 100_000 });
  return { ...p, efectivo };
}

describe('Primera fecha de la tanda sin teclear (auditoría B-3 · 6)', () => {
  it('ofrece hoy, el próximo 15 y el último del mes, sin repetir', () => {
    expect(fechasCercanas('2026-10-22')).toEqual(['2026-10-22', '2026-10-31', '2026-11-15']);
    expect(fechasCercanas('2026-10-15')).toEqual(['2026-10-15', '2026-10-31']);
    expect(fechasCercanas('2026-10-31')).toEqual(['2026-10-31', '2026-11-15']);
    expect(fechasCercanas('2026-02-03')).toEqual(['2026-02-03', '2026-02-15', '2026-02-28']);
  });

  it('un chip llena la fecha; una fecha que no se lee marca el campo y dice cómo escribirla', () => {
    const p = preparar('2026-10-22');
    renderConSesion(p.ctx, <PantallaTandas alVolver={jest.fn()} alAbrirTanda={jest.fn()} nuevaAlInicio />);
    expect(screen.getByTestId('tanda-inicio').props.value).toBe('22/10/2026');
    expect(screen.getByTestId('tanda-fecha-2026-10-22').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByTestId('tanda-fecha-2026-11-15'));
    expect(screen.getByTestId('tanda-inicio').props.value).toBe('15/11/2026');
    expect(screen.getByTestId('tanda-fecha-2026-11-15').props.accessibilityState).toMatchObject({
      selected: true,
    });

    fireEvent.changeText(screen.getByTestId('tanda-aportacion'), '500');
    fireEvent.press(screen.getByTestId('tanda-frecuencia-semanal'));
    fireEvent.changeText(screen.getByTestId('tanda-participantes'), '10');
    fireEvent.changeText(screen.getByTestId('tanda-turno'), '4');
    fireEvent.changeText(screen.getByTestId('tanda-inicio'), '15 de nov');
    fireEvent.press(screen.getByTestId('tanda-guardar'));
    expect(screen.getByTestId('error-formulario')).toHaveTextContent(ERROR_FECHA_INICIO);
    expect(screen.getByTestId('tanda-inicio')).toHaveProp('accessibilityHint', MARCA_FECHA_INVALIDA);
    fireEvent.press(screen.getByTestId('tanda-fecha-2026-10-31'));
    expect(screen.getByTestId('tanda-inicio').props.value).toBe('31/10/2026');
    expect(screen.getByTestId('tanda-inicio').props.accessibilityHint).not.toBe(MARCA_FECHA_INVALIDA);
    p.cerrar();
  });
});

describe('"Ya la di" sin cuenta (auditoría B-3 · 6)', () => {
  it('"¿De dónde salió?" tiene Cancelar y no registra nada', () => {
    const p = preparar('2026-10-16');
    const { tandaId } = crearTanda(p.ctx, {
      nombre: 'Oficina',
      aportacion: 50_000,
      participantes: 10,
      turno: 4,
      regla: reglaDeFrecuencia('semanal', '2026-10-16'),
      inicio: '2026-10-16',
      cuentaId: null,
    });
    renderConSesion(p.ctx, <PantallaTanda tandaId={tandaId} alVolver={jest.fn()} />);
    const antes = detalleTanda(p.ctx, tandaId).aportado;
    fireEvent.press(screen.getByTestId('tanda-ya-la-di'));
    expect(screen.getByTestId(`tanda-ya-la-di-cuenta-${p.efectivo}`)).toBeTruthy();
    expect(screen.getByTestId('tanda-ya-la-di-cuenta-cancelar')).toHaveProp(
      'accessibilityHint',
      PISTA_CANCELAR_APORTACION,
    );
    fireEvent.press(screen.getByTestId('tanda-ya-la-di-cuenta-cancelar'));
    expect(screen.queryByTestId(`tanda-ya-la-di-cuenta-${p.efectivo}`)).toBeNull();
    expect(screen.getByTestId('tanda-ya-la-di')).toBeTruthy();
    expect(detalleTanda(p.ctx, tandaId).aportado).toBe(antes);
    p.cerrar();
  });
});
