import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { coloresCategoria } from '../tokens';
import { Mosaico } from './Mosaico';
import { Orbe } from './Orbe';

const fondo = (testID: string) =>
  (StyleSheet.flatten(screen.getByTestId(testID).props.style) as { backgroundColor?: string })
    .backgroundColor;

describe('Orbe (B+ «Viva», D0)', () => {
  it('es decorativo: el lector no lo lee y no recibe toques', () => {
    render(<Orbe />);
    const o = screen.getByTestId('orbe');
    expect(o.props.accessibilityElementsHidden).toBe(true);
    expect(o.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(o.props.pointerEvents).toBe('none');
  });

  it('al escuchar lanza ondas; en reposo, no', async () => {
    render(<Orbe estado="escuchando" testID="o1" />);
    await act(async () => {});
    expect(screen.getByTestId('o1-ondas')).toBeTruthy();
    render(<Orbe estado="reposo" testID="o2" />);
    expect(screen.queryByTestId('o2-ondas')).toBeNull();
  });

  it('con «Reducir movimiento» no hay ondas aunque escuche (02 §15)', async () => {
    const espia = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    try {
      render(<Orbe estado="escuchando" />);
      await act(async () => {});
      expect(screen.queryByTestId('orbe-ondas')).toBeNull();
    } finally {
      espia.mockResolvedValue(false);
    }
  });
});

describe('Mosaico de categoría (B+, D0)', () => {
  it('lleva el color de la familia de su categoría; lo que no tiene familia va en gris', () => {
    render(
      <>
        <Mosaico slug="antojos" testID="m-antojos" />
        <Mosaico slug="comida_fuera" testID="m-comida" />
        <Mosaico slug={null} testID="m-nada" />
        <Mosaico familia="salidas" icono="tarjeta" testID="m-credito" />
      </>,
    );
    expect(fondo('m-antojos')).toBe(coloresCategoria.claro.antojos.mosaico);
    expect(fondo('m-comida')).toBe(coloresCategoria.claro.comidaFuera.mosaico);
    expect(fondo('m-nada')).toBe(coloresCategoria.claro.otros.mosaico);
    expect(fondo('m-credito')).toBe(coloresCategoria.claro.salidas.mosaico);
    expect(screen.getByTestId('m-antojos').props.accessibilityElementsHidden).toBe(true);
  });
});
