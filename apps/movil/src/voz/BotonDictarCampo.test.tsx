import { interpretarMonto } from '@cartera/nlu';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { crearMotorFalso } from '../pantallas/principal/__pruebas__/arnes';
import { CampoMonto, ContextoDictadoCampos, type DictadoCampos, type PropsBotonDictarCampo } from '../ui';
import { BotonDictarCampo } from './BotonDictarCampo';
import type { MotorDictado } from './motor';

function conDictado(motor: ReturnType<typeof crearMotorFalso>['motor'], ui: ReactNode) {
  const valor: DictadoCampos = {
    BotonDictar: (p: PropsBotonDictarCampo) => <BotonDictarCampo {...p} motor={motor} />,
    interpretarMonto,
  };
  return render(<ContextoDictadoCampos.Provider value={valor}>{ui}</ContextoDictadoCampos.Provider>);
}

/** Toca el micrófono, emite la transcripción final y deja que termine. */
async function dictar(f: ReturnType<typeof crearMotorFalso>, texto: string) {
  fireEvent(screen.getByTestId('monto-dictar'), 'pressIn');
  await act(async () => {});
  fireEvent(screen.getByTestId('monto-dictar'), 'pressOut');
  f.emitir({ tipo: 'resultado', texto, final: true });
}

describe('Micrófono en los campos de monto', () => {
  it('sin proveedor no hay micrófono (calculadora, pruebas de ui)', () => {
    render(<CampoMonto etiqueta="Monto" alCambiar={jest.fn()} testID="monto" />);
    expect(screen.queryByTestId('monto-dictar')).toBeNull();
  });

  it('«mil quinientos» llena el campo con 150000 centavos y se puede deshacer', async () => {
    const f = crearMotorFalso();
    const alCambiar = jest.fn();
    conDictado(
      f.motor,
      <CampoMonto etiqueta="Monto" alCambiar={alCambiar} valorInicial={null} testID="monto" />,
    );
    expect(screen.getByTestId('monto-dictar')).toHaveProp('accessibilityLabel', 'Dictar Monto');
    await dictar(f, 'mil quinientos');
    expect(alCambiar).toHaveBeenLastCalledWith(150_000);
    expect(screen.getByTestId('monto').props.value).toBe('1,500');
    expect(screen.getByTestId('monto-oido')).toHaveTextContent('Oí «mil quinientos»: $1,500.');
    fireEvent.press(screen.getByTestId('monto-deshacer'));
    expect(alCambiar).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('monto').props.value).toBe('');
  });

  it('si no entiende el monto, el campo no cambia y lo dice', async () => {
    const f = crearMotorFalso();
    const alCambiar = jest.fn();
    conDictado(f.motor, <CampoMonto etiqueta="Monto" alCambiar={alCambiar} testID="monto" />);
    await dictar(f, 'dos cincuenta');
    expect(alCambiar).not.toHaveBeenCalled();
    expect(screen.getByTestId('monto-oido')).toHaveTextContent(/No entendí el monto/);
    expect(screen.queryByTestId('monto-deshacer')).toBeNull();
  });

  it('un aproximado se marca para que ponga la cifra exacta', async () => {
    const f = crearMotorFalso();
    conDictado(f.motor, <CampoMonto etiqueta="Monto" alCambiar={jest.fn()} testID="monto" />);
    await dictar(f, 'como 500');
    expect(screen.getByTestId('monto-oido')).toHaveTextContent(/aproximado/);
  });

  it('sin permiso ofrece «Abrir ajustes» y el campo sigue funcionando a mano', async () => {
    const f = crearMotorFalso();
    (f.motor as MotorDictado).solicitarPermiso = async () => false;
    const alCambiar = jest.fn();
    conDictado(f.motor, <CampoMonto etiqueta="Monto" alCambiar={alCambiar} testID="monto" />);
    fireEvent(screen.getByTestId('monto-dictar'), 'pressIn');
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Abrir ajustes' })).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('monto'), '80');
    expect(alCambiar).toHaveBeenLastCalledWith(8_000);
  });

  it('sin reconocimiento en el teléfono no se muestra', () => {
    const f = crearMotorFalso();
    (f.motor as MotorDictado).disponible = () => false;
    conDictado(f.motor, <CampoMonto etiqueta="Monto" alCambiar={jest.fn()} testID="monto" />);
    expect(screen.queryByTestId('monto-dictar')).toBeNull();
  });

  it('con dictable={false} no hay micrófono', () => {
    const f = crearMotorFalso();
    conDictado(
      f.motor,
      <CampoMonto etiqueta="Monto" alCambiar={jest.fn()} dictable={false} testID="monto" />,
    );
    expect(screen.queryByTestId('monto-dictar')).toBeNull();
  });
});
