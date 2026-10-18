import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  Aviso,
  Boton,
  CampoMonto,
  CampoTexto,
  Cifra,
  ERROR_FORMATO_MONTO,
  Interruptor,
  Pantalla,
  Tarjeta,
  Texto,
  useAviso,
} from './index';

describe('Cifra', () => {
  it('muestra el monto formateado y lo etiqueta en palabras para TalkBack', () => {
    render(<Cifra centavos={21499} modo="pesos" contexto="Hoy puedes gastar" testID="c" />);
    const cifra = screen.getByTestId('c');
    expect(cifra).toHaveTextContent('$214');
    expect(cifra.props.accessibilityLabel).toBe('Hoy puedes gastar doscientos catorce pesos');
    expect(cifra.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontVariant: ['tabular-nums'] })]),
    );
  });

  it('modo centavos', () => {
    render(<Cifra centavos={150000} modo="centavos" />);
    expect(screen.getByText('$1,500.00')).toBeTruthy();
  });

  it('no corta la cifra (sin numberOfLines) para texto al 200 %', () => {
    render(<Cifra centavos={123456789} testID="c" />);
    expect(screen.getByTestId('c').props.numberOfLines).toBeUndefined();
  });
});

describe('Boton', () => {
  it('expone rol, etiqueta y llama alPresionar', () => {
    const alPresionar = jest.fn();
    render(<Boton etiqueta="Guardar" alPresionar={alPresionar} pista="Guarda el movimiento" />);
    const boton = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.press(boton);
    expect(alPresionar).toHaveBeenCalledTimes(1);
    expect(boton.props.accessibilityHint).toBe('Guarda el movimiento');
  });

  it('deshabilitado no responde y lo anuncia', () => {
    const alPresionar = jest.fn();
    render(<Boton etiqueta="Guardar" alPresionar={alPresionar} deshabilitado variante="secundario" />);
    const boton = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.press(boton);
    expect(alPresionar).not.toHaveBeenCalled();
    expect(boton).toBeDisabled();
  });

  it.each(['primario', 'secundario', 'texto'] as const)('variante %s mide al menos 48 dp', (v) => {
    render(<Boton etiqueta="Ver qué viene" alPresionar={() => {}} variante={v} />);
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: 48, minWidth: 48 });
  });
});

describe('Interruptor', () => {
  function Controlado() {
    const [valor, setValor] = useState(false);
    return (
      <Interruptor
        etiqueta="Apartar lo que le debo"
        descripcion="No cuenta como dinero libre"
        valor={valor}
        alCambiar={setValor}
      />
    );
  }

  it('la fila completa cambia el valor y anuncia el estado', () => {
    render(<Controlado />);
    const fila = screen.getByRole('switch', { name: 'Apartar lo que le debo' });
    expect(fila).not.toBeChecked();
    fireEvent.press(fila);
    expect(screen.getByRole('switch', { name: 'Apartar lo que le debo' })).toBeChecked();
    expect(screen.getByText('No cuenta como dinero libre')).toBeTruthy();
  });
});

describe('CampoTexto', () => {
  it('etiqueta accesible y error visible', () => {
    const alCambiar = jest.fn();
    render(
      <CampoTexto
        etiqueta="Qué compraste"
        valor=""
        alCambiar={alCambiar}
        ejemplo="tacos 80 en efectivo"
        error="Falta el monto. Escríbelo con números."
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Qué compraste'), 'coca 25');
    expect(alCambiar).toHaveBeenCalledWith('coca 25');
    expect(screen.getByText('Falta el monto. Escríbelo con números.')).toBeTruthy();
  });
});

describe('CampoMonto', () => {
  it('convierte pesos escritos a centavos enteros', () => {
    const alCambiar = jest.fn();
    render(<CampoMonto etiqueta="Monto" alCambiar={alCambiar} />);
    const campo = screen.getByLabelText('Monto');
    fireEvent.changeText(campo, '1,099.9');
    expect(alCambiar).toHaveBeenLastCalledWith(109990);
    fireEvent.changeText(campo, '');
    expect(alCambiar).toHaveBeenLastCalledWith(null);
  });

  it('marca el texto que no es monto', () => {
    const alCambiar = jest.fn();
    render(<CampoMonto etiqueta="Monto" alCambiar={alCambiar} />);
    fireEvent.changeText(screen.getByLabelText('Monto'), '12.345');
    expect(alCambiar).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(ERROR_FORMATO_MONTO)).toBeTruthy();
  });

  it('muestra el valor inicial sin signo de pesos', () => {
    render(<CampoMonto etiqueta="Monto" valorInicial={150050} alCambiar={() => {}} />);
    expect(screen.getByLabelText('Monto').props.value).toBe('1,500.50');
  });
});

describe('Tarjeta, Texto y Pantalla', () => {
  it('tarjeta tocable es un botón', () => {
    const alPresionar = jest.fn();
    render(
      <Pantalla pie={<Boton etiqueta="Guardar" alPresionar={() => {}} />}>
        <Texto variante="titulo">Cuentas</Texto>
        <Tarjeta alPresionar={alPresionar} etiquetaAccesible="Efectivo">
          <Text>Efectivo</Text>
        </Tarjeta>
      </Pantalla>,
    );
    expect(screen.getByRole('header', { name: 'Cuentas' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Efectivo' }));
    expect(alPresionar).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
  });
});

describe('Aviso con Deshacer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function Demo({ deshacer }: { deshacer: () => void }) {
    const { aviso, mostrar, cerrar } = useAviso();
    return (
      <>
        <Boton
          etiqueta="Registrar"
          alPresionar={() =>
            mostrar({
              mensaje: 'Registré: Coca $25 · Antojos · Efectivo',
              accion: { etiqueta: 'Deshacer', alPresionar: deshacer },
            })
          }
        />
        <Aviso aviso={aviso} alCerrar={cerrar} />
      </>
    );
  }

  it('"Deshacer" llama la acción y cierra el aviso', () => {
    const deshacer = jest.fn();
    render(<Demo deshacer={deshacer} />);
    fireEvent.press(screen.getByRole('button', { name: 'Registrar' }));
    fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(deshacer).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('se cierra solo a los 10 s y un aviso nuevo reinicia el tiempo', () => {
    render(<Demo deshacer={() => {}} />);
    fireEvent.press(screen.getByRole('button', { name: 'Registrar' }));
    act(() => jest.advanceTimersByTime(8000));
    fireEvent.press(screen.getByRole('button', { name: 'Registrar' }));
    act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByTestId('aviso')).toBeTruthy();
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.queryByTestId('aviso')).toBeNull();
  });
});
