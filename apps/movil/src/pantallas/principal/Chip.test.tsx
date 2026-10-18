import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Chip, GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from './Chip';

describe('Chip (TalkBack)', () => {
  it('radio: etiqueta hablada, selected sin checked, texto visible oculto', () => {
    render(
      <Chip etiqueta="Efectivo" seleccionado alPresionar={() => {}} testID="c" />,
    );
    const chip = screen.getByTestId('c');
    expect(chip.props.accessibilityRole).toBe('radio');
    expect(chip.props.accessibilityLabel).toBe('Efectivo');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    const texto = screen.getByText('✓ Efectivo');
    expect(texto.props.accessibilityElementsHidden).toBe(true);
    expect(texto.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('checkbox: anuncia checked', () => {
    render(
      <Chip etiqueta="Caro" seleccionado multiple alPresionar={() => {}} testID="c" />,
    );
    expect(screen.getByTestId('c').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId('c').props.accessibilityRole).toBe('checkbox');
  });

  it('«Nombre ×2» se lee como «Nombre, 2 veces»', () => {
    render(
      <Chip etiqueta="Caro ×2" seleccionado multiple alPresionar={() => {}} testID="c" />,
    );
    expect(screen.getByTestId('c').props.accessibilityLabel).toBe('Caro, 2 veces');
  });

  it('etiquetaAccesible gana sobre el visible', () => {
    render(
      <Chip
        etiqueta="Caro ×2"
        etiquetaAccesible="Caro, dos partes"
        seleccionado={false}
        alPresionar={() => {}}
        testID="c"
      />,
    );
    expect(screen.getByTestId('c').props.accessibilityLabel).toBe('Caro, dos partes');
  });

  it('llama alPresionar', () => {
    const alPresionar = jest.fn();
    render(<Chip etiqueta="Débito" seleccionado={false} alPresionar={alPresionar} testID="c" />);
    fireEvent.press(screen.getByTestId('c'));
    expect(alPresionar).toHaveBeenCalledTimes(1);
  });
});

describe('GrupoChips (TalkBack)', () => {
  const opciones = [
    { valor: 'efectivo' as const, etiqueta: 'Efectivo' },
    { valor: 'debito' as const, etiqueta: 'Débito' },
  ];

  it('radiogroup con etiqueta hablada y chips radio', () => {
    render(
      <GrupoChips
        opciones={opciones}
        valor="efectivo"
        alCambiar={() => {}}
        etiqueta="¿Con qué pagaste?"
        prefijoTestID="pago"
      />,
    );
    const grupo = screen.getByRole('radiogroup', { name: '¿Con qué pagaste?' });
    expect(grupo).toBeTruthy();
    expect(screen.getByTestId('pago-efectivo').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('pago-debito').props.accessibilityState).toEqual({ selected: false });
  });

  it('pasa etiquetaAccesible de la opción al chip', () => {
    render(
      <GrupoChips
        opciones={[{ valor: 'msi', etiqueta: '3 MSI', etiquetaAccesible: 'Tres meses sin intereses' }]}
        valor={null}
        alCambiar={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Tres meses sin intereses' })).toBeTruthy();
  });
});

describe('OCULTAR_ETIQUETA_VISIBLE', () => {
  it('oculta la pregunta visible duplicada del radiogroup', () => {
    render(
      <Text {...OCULTAR_ETIQUETA_VISIBLE} testID="pregunta">
        ¿Con qué pagaste?
      </Text>,
    );
    const pregunta = screen.getByTestId('pregunta');
    expect(pregunta.props.accessibilityElementsHidden).toBe(true);
    expect(pregunta.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
