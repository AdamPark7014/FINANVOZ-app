import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  Aviso,
  Barra,
  Boton,
  Chip,
  CampoMonto,
  CampoTexto,
  EstadoVacio,
  Cifra,
  ERROR_FORMATO_MONTO,
  Interruptor,
  Pantalla,
  Tarjeta,
  Texto,
  useAviso,
} from './index';

describe('Barra', () => {
  it('expone progreso en la etiqueta y el valor accesible', () => {
    render(<Barra llenoBp={3500} etiquetaAccesible="Usaste el 35 % de tu tarjeta" testID="b" />);
    const barra = screen.getByTestId('b');
    expect(barra.props.accessibilityRole).toBe('progressbar');
    expect(barra.props.accessibilityLabel).toBe('Usaste el 35 % de tu tarjeta');
    expect(barra.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 35, text: '35%' });
  });
});

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

  it('centavos negativos en modo pesos redondean hacia abajo (−$1, no $0)', () => {
    render(<Cifra centavos={-99} modo="pesos" contexto="Reservado" testID="c" />);
    const cifra = screen.getByTestId('c');
    expect(cifra).toHaveTextContent('−$1');
    expect(cifra.props.accessibilityLabel).toBe('Reservado menos un peso');
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
    expect(boton.props.accessibilityState).toEqual({ disabled: true, busy: false });
  });

  it.each(['primario', 'secundario', 'texto'] as const)('variante %s mide al menos 48 dp', (v) => {
    render(<Boton etiqueta="Ver qué viene" alPresionar={() => {}} variante={v} />);
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: 48, minWidth: 48 });
  });

  it('cargando anuncia ocupado y deshabilitado en TalkBack', () => {
    render(<Boton etiqueta="Guardar" alPresionar={() => {}} cargando />);
    const boton = screen.getByRole('button', { name: 'Guardar' });
    expect(boton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(boton.props.accessibilityHint).toBe('Espera, termina de cargar');
    expect(boton).toBeDisabled();
  });
});


describe('Chip', () => {
  it('hitSlop táctil y deshabilitado en TalkBack', () => {
    const alPresionar = jest.fn();
    render(
      <Chip etiqueta="Efectivo" seleccionado={false} alPresionar={alPresionar} deshabilitado testID="chip" />,
    );
    const chip = screen.getByTestId('chip');
    expect(chip.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
    expect(chip.props.accessibilityState).toEqual({ selected: false, disabled: true });
    fireEvent.press(chip);
    expect(alPresionar).not.toHaveBeenCalled();
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
    const interruptor = screen.getByRole('switch', { name: 'Apartar lo que le debo' });
    expect(interruptor).toBeChecked();
    expect(interruptor.props.accessibilityHint).toBe('No cuenta como dinero libre');
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
    expect(screen.getByLabelText('Qué compraste').props.accessibilityState).toEqual({ invalid: true, disabled: false });
  });

  it('deshabilitado anuncia disabled', () => {
    render(
      <CampoTexto etiqueta="Notas" valor="" alCambiar={() => {}} deshabilitado />,
    );
    expect(screen.getByLabelText('Notas').props.accessibilityState).toEqual({ invalid: false, disabled: true });
  });

  it('la ayuda visible no duplica la pista del campo', () => {
    render(
      <CampoTexto
        etiqueta="Notas"
        valor=""
        alCambiar={() => {}}
        ayuda="Opcional. Solo para ti."
      />,
    );
    const campo = screen.getByLabelText('Notas');
    expect(campo.props.accessibilityHint).toBe('Opcional. Solo para ti.');
    expect(screen.getByText('Opcional. Solo para ti.', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(
      true,
    );
  });
});

describe('EstadoVacio', () => {
  it('anuncia el copy con live region', () => {
    render(<EstadoVacio texto="Todavía no hay movimientos." testID="vacio" />);
    const vacio = screen.getByTestId('vacio');
    expect(vacio).toHaveTextContent('Todavía no hay movimientos.');
    expect(vacio.props.accessibilityLiveRegion).toBe('polite');
    expect(vacio.props.accessibilityLabel).toBe('Todavía no hay movimientos.');
  });

  it('lee cifras del copy en palabras cuando no hay etiquetaAccesible', () => {
    render(<EstadoVacio texto="Faltan $315 en el arqueo." testID="vacio" />);
    expect(screen.getByTestId('vacio')).toHaveProp(
      'accessibilityLabel',
      'Faltan trescientos quince pesos en el arqueo.',
    );
  });

  it('etiquetaAccesible sobrescribe el label de TalkBack', () => {
    render(
      <EstadoVacio
        texto="No debes nada."
        testID="vacio"
        etiquetaAccesible="Debes. No debes nada."
      />,
    );
    expect(screen.getByTestId('vacio')).toHaveProp('accessibilityLabel', 'Debes. No debes nada.');
  });
});

describe('CampoMonto', () => {
  it('convierte pesos escritos a centavos enteros', () => {
    const alCambiar = jest.fn();
    render(<CampoMonto etiqueta="Monto" alCambiar={alCambiar} />);
    const campo = screen.getByLabelText('Monto en pesos');
    fireEvent.changeText(campo, '1,099.9');
    expect(alCambiar).toHaveBeenLastCalledWith(109990);
    fireEvent.changeText(campo, '');
    expect(alCambiar).toHaveBeenLastCalledWith(null);
  });

  it('marca el texto que no es monto', () => {
    const alCambiar = jest.fn();
    render(<CampoMonto etiqueta="Monto" alCambiar={alCambiar} />);
    fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '12.345');
    expect(alCambiar).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(ERROR_FORMATO_MONTO)).toBeTruthy();
  });

  it('muestra el valor inicial sin signo de pesos', () => {
    render(<CampoMonto etiqueta="Monto" valorInicial={150050} alCambiar={() => {}} />);
    expect(screen.getByLabelText(/Monto en pesos/).props.value).toBe('1,500.50');
  });

  it('etiqueta TalkBack en pesos y lee el monto escrito en palabras', () => {
    const alCambiar = jest.fn();
    render(<CampoMonto etiqueta="Monto" alCambiar={alCambiar} />);
    expect(screen.getByLabelText('Monto en pesos')).toHaveProp('accessibilityLabel', 'Monto en pesos');
    const campo = screen.getByLabelText('Monto en pesos');
    fireEvent.changeText(campo, '1,099.90');
    expect(campo).toHaveProp(
      'accessibilityLabel',
      'Monto en pesos, mil noventa y nueve pesos con noventa centavos',
    );
  });

  it('deshabilitado anuncia disabled en TalkBack', () => {
    render(<CampoMonto etiqueta="Monto" alCambiar={() => {}} deshabilitado />);
    expect(screen.getByLabelText('Monto en pesos').props.accessibilityState).toEqual({
      invalid: false,
      disabled: true,
    });
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
