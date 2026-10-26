import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Linking, Platform, Pressable } from 'react-native';
import { auditar } from '../../pantallas/__pruebas__/accesibilidad';
import { crearMotorFalso, type OpcionesMotorFalso } from '../../voz/__pruebas__/motor-falso';
import { ProveedorDictado, type LectorMonto } from '../../voz/ProveedorDictado';
import { ETIQUETA_ESCUCHANDO, MENSAJES_DICTADO_CAMPO, PISTA_MICROFONO_CAMPO } from '../../voz/textos';
import { CampoMonto, ERROR_FORMATO_MONTO, type CampoMontoProps } from './CampoMonto';
import {
  ContextoDictadoCampos,
  PISTA_CAMPO_ESCUCHANDO,
  type LectorMontoDictado,
  type PropsBotonDictarCampo,
} from './dictado-campo';

/**
 * Integración con el micrófono real de la app (`ProveedorDictado` de `voz/`, que inyecta `BotonDictarCampo`).
 * Lector falso: el de verdad (intérprete) se prueba en `servicios/voz-campos` y en `@cartera/nlu`.
 */
const LECTURAS: Record<string, ReturnType<LectorMonto>> = {
  'ocho mil quinientos': { centavos: 850_000, aproximado: false },
  'como quinientos': { centavos: 50_000, aproximado: true },
  'unos mil doscientos': { centavos: 120_000, aproximado: true },
  cero: { centavos: 0, aproximado: false },
};
const leerMonto = jest.fn<ReturnType<LectorMonto>, Parameters<LectorMonto>>(
  (texto) => LECTURAS[texto] ?? null,
);

let anunciar: jest.SpyInstance;
beforeEach(() => {
  leerMonto.mockClear();
  // El setup de RN ya trae `AccessibilityInfo` como `jest.fn()`: `spyOn` devuelve ese mismo mock, que
  // `restoreAllMocks` no limpia; se limpia aquí para no arrastrar llamadas de otra prueba.
  anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  anunciar.mockClear();
});
afterEach(() => jest.restoreAllMocks());

function montar(props: Partial<CampoMontoProps> = {}, opciones: OpcionesMotorFalso = {}) {
  const falso = crearMotorFalso(opciones);
  const alCambiar = jest.fn();
  render(
    <ProveedorDictado motor={falso.motor} leerMonto={leerMonto}>
      <CampoMonto etiqueta="Monto" alCambiar={alCambiar} testID="monto" {...props} />
    </ProveedorDictado>,
  );
  return { ...falso, alCambiar };
}

const campo = () => screen.getByTestId('monto');
const microfono = (id = 'monto-microfono') => screen.getByTestId(id);
const ayuda = () => screen.getByTestId('monto-ayuda');

/** Toque corto: empieza a escuchar y sigue escuchando hasta que el reconocedor termina. */
async function tocar(id = 'monto-microfono') {
  await act(async () => {
    fireEvent(microfono(id), 'pressIn');
  });
  fireEvent(microfono(id), 'pressOut');
}

describe('CampoMonto · miles en vivo (H8)', () => {
  /** Como el teclado: una tecla a la vez sobre lo que el campo ya muestra. */
  function teclear(texto: string) {
    for (const letra of texto) fireEvent.changeText(campo(), `${campo().props.value as string}${letra}`);
  }

  it('«13000» se ve «13,000» mientras se teclea y avisa 13 mil pesos en centavos', () => {
    const { alCambiar } = montar();
    teclear('13000');
    expect(campo().props.value).toBe('13,000');
    expect(alCambiar).toHaveBeenLastCalledWith(1_300_000);
    expect(screen.queryByText(ERROR_FORMATO_MONTO)).toBeNull();
    // Borrar un dígito vuelve a agrupar.
    fireEvent.changeText(campo(), '13,00');
    expect(campo().props.value).toBe('1,300');
    expect(alCambiar).toHaveBeenLastCalledWith(130_000);
  });

  it('una coma que escribe la persona no se reinterpreta: «12,50» enseña el error y no avisa monto', () => {
    const { alCambiar } = montar();
    teclear('12,50');
    expect(campo().props.value).toBe('12,50');
    expect(alCambiar).toHaveBeenLastCalledWith(null);
  });
});

describe('CampoMonto · dictar la cifra', () => {
  it('sin ProveedorDictado no hay micrófono (pruebas y pantallas sueltas)', () => {
    render(<CampoMonto etiqueta="Monto" alCambiar={() => {}} testID="monto" />);
    expect(screen.queryByTestId('monto-microfono')).toBeNull();
  });

  it('sin reconocimiento en el teléfono no hay micrófono ni se suscribe al reconocedor', () => {
    const { motor } = montar({}, { disponible: false });
    expect(screen.queryByTestId('monto-microfono')).toBeNull();
    expect(motor.suscribir).not.toHaveBeenCalled();
  });

  it('dictable={false} o deshabilitado: sin micrófono', () => {
    const { motor } = montar({ dictable: false });
    expect(screen.queryByTestId('monto-microfono')).toBeNull();
    screen.unmount();
    montar({ deshabilitado: true });
    expect(screen.queryByTestId('monto-microfono')).toBeNull();
    expect(motor.suscribir).not.toHaveBeenCalled();
  });

  it('entendido: escribe la cifra en el campo, avisa el cambio y dice qué oyó', async () => {
    const { motor, emitir, alCambiar } = montar();
    await tocar();
    expect(motor.iniciar).toHaveBeenCalledTimes(1);
    expect(motor.iniciar).toHaveBeenCalledWith(expect.objectContaining({ idioma: 'es-MX' }));
    expect(microfono().props.accessibilityLabel).toBe(ETIQUETA_ESCUCHANDO);
    expect(ayuda()).toHaveTextContent('Te escucho…');

    emitir({ tipo: 'resultado', texto: 'ocho mil', final: false });
    expect(ayuda()).toHaveTextContent('«ocho mil»');

    emitir({ tipo: 'resultado', texto: 'ocho mil quinientos', final: true });
    expect(leerMonto).toHaveBeenCalledWith('ocho mil quinientos', { admiteCero: false });
    expect(campo().props.value).toBe('8,500');
    expect(alCambiar).toHaveBeenLastCalledWith(850_000);
    expect(ayuda()).toHaveTextContent('Oí «ocho mil quinientos»: puse $8,500.');
    expect(campo().props.accessibilityLabel).toMatch(/^Monto en pesos, ocho mil quinientos pesos/);
    expect(microfono().props.accessibilityLabel).toBe('Dictar en voz: Monto');
  });

  it('al teclear después de dictar, lo que se oyó deja de ser la ayuda', async () => {
    const { emitir, alCambiar } = montar({ ayuda: 'Lo que pagaste.' });
    await tocar();
    emitir({ tipo: 'resultado', texto: 'ocho mil quinientos', final: true });
    expect(ayuda()).toHaveTextContent('Oí «ocho mil quinientos»: puse $8,500.');
    fireEvent.changeText(campo(), '9,000');
    expect(alCambiar).toHaveBeenLastCalledWith(900_000);
    expect(ayuda()).toHaveTextContent('Lo que pagaste.');
  });

  it('aproximado: escribe la cifra y pide corregirla si se sabe la exacta', async () => {
    const { emitir, alCambiar } = montar();
    await tocar();
    emitir({ tipo: 'resultado', texto: 'como quinientos', final: true });
    expect(campo().props.value).toBe('500');
    expect(alCambiar).toHaveBeenLastCalledWith(50_000);
    expect(ayuda()).toHaveTextContent('Dijiste «como»: corrígelo si sabes la cifra exacta.');
  });

  it('no entendido: no toca el campo ni avisa cambio, y pide decirla otra vez', async () => {
    const { emitir, alCambiar } = montar();
    fireEvent.changeText(campo(), '120');
    alCambiar.mockClear();
    await tocar();
    emitir({ tipo: 'resultado', texto: 'hola qué tal', final: true });
    expect(campo().props.value).toBe('120');
    expect(alCambiar).not.toHaveBeenCalled();
    expect(ayuda()).toHaveTextContent('No entendí la cifra en «hola qué tal». Dila otra vez o escríbela.');
  });

  it('$0 solo se escribe si el campo lo admite', async () => {
    const sinCero = montar();
    await tocar();
    sinCero.emitir({ tipo: 'resultado', texto: 'cero', final: true });
    expect(leerMonto).toHaveBeenLastCalledWith('cero', { admiteCero: false });
    expect(campo().props.value).toBe('');
    expect(sinCero.alCambiar).not.toHaveBeenCalled();
    screen.unmount();

    const conCero = montar({ admiteCero: true });
    await tocar();
    conCero.emitir({ tipo: 'resultado', texto: 'cero', final: true });
    expect(leerMonto).toHaveBeenLastCalledWith('cero', { admiteCero: true });
    expect(campo().props.value).toBe('0');
    expect(conCero.alCambiar).toHaveBeenLastCalledWith(0);
  });

  it('sin permiso del micrófono: no escucha, explica cómo dictar o escribirla y ofrece "Abrir Ajustes"', async () => {
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { motor } = montar({}, { permiso: false });
    expect(screen.queryByTestId('monto-ajustes')).toBeNull();
    await tocar();
    expect(motor.iniciar).not.toHaveBeenCalled();
    expect(ayuda()).toHaveTextContent(MENSAJES_DICTADO_CAMPO.sin_permiso);
    expect(ayuda().props.accessibilityLiveRegion).toBe('polite');
    expect(MENSAJES_DICTADO_CAMPO.sin_permiso).not.toMatch(/gasto|registro/i);

    const ajustes = screen.getByTestId('monto-ajustes');
    expect(ajustes.props.accessibilityRole).toBe('button');
    expect(ajustes.props.accessibilityLabel).toBe('Abrir Ajustes');
    fireEvent.press(ajustes);
    expect(abrir).toHaveBeenCalledTimes(1);

    // Al teclear la cifra, el aviso y el botón se van.
    fireEvent.changeText(campo(), '300');
    expect(screen.queryByTestId('monto-ajustes')).toBeNull();
  });

  it('iPhone sin permiso: nombra los dos permisos que pide iOS y lo anuncia', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    montar({}, { permiso: false });
    await tocar();
    expect(ayuda()).toHaveTextContent(MENSAJES_DICTADO_CAMPO.sin_permiso_ios);
    expect(MENSAJES_DICTADO_CAMPO.sin_permiso_ios).toMatch(/micrófono y el reconocimiento de voz/);
    expect(anunciar).toHaveBeenCalledWith(MENSAJES_DICTADO_CAMPO.sin_permiso_ios);
    expect(screen.getByTestId('monto-ajustes')).toBeTruthy();
  });

  it('no se oyó nada: mensaje del campo, no el del registro', async () => {
    const { emitir } = montar();
    await tocar();
    emitir({ tipo: 'error', codigo: 'no-speech' });
    expect(ayuda()).toHaveTextContent(MENSAJES_DICTADO_CAMPO.sin_voz);
    expect(microfono().props.accessibilityLabel).toBe('Dictar en voz: Monto');
  });

  describe('accesibilidad', () => {
    it('el micrófono es un botón de 48 dp con nombre sin cifras y acción "activar"', () => {
      montar();
      const mic = microfono();
      expect(mic.props.accessibilityRole).toBe('button');
      expect(mic.props.accessibilityLabel).toBe('Dictar en voz: Monto');
      expect(mic.props.accessibilityHint).toBe(PISTA_MICROFONO_CAMPO);
      expect(mic.props.accessibilityActions).toEqual([{ name: 'activate' }]);
      expect(auditar(screen.toJSON() as never, { etiquetaExplicita: true })).toEqual([]);
    });

    it('mientras escucha, ni la pista ni las etiquetas llevan cifras; la transcripción solo se ve', async () => {
      const { emitir } = montar();
      await tocar();
      emitir({ tipo: 'resultado', texto: '8500', final: false });
      expect(ayuda()).toHaveTextContent('«8500»');
      expect(ayuda().props.accessibilityElementsHidden).toBe(true);
      expect(ayuda().props.accessibilityLiveRegion).toBeUndefined();
      expect(campo().props.accessibilityHint).toBe(PISTA_CAMPO_ESCUCHANDO);
      expect(campo().props.accessibilityHint).not.toMatch(/\d/);
      expect(microfono().props.accessibilityLabel).not.toMatch(/\d/);
      expect(anunciar).not.toHaveBeenCalled();
    });

    it('Android: el resultado final se lee por región viva, en palabras', async () => {
      const { emitir } = montar();
      await tocar();
      emitir({ tipo: 'resultado', texto: 'ocho mil quinientos', final: true });
      expect(ayuda().props.accessibilityLiveRegion).toBe('polite');
      expect(ayuda().props.accessibilityElementsHidden).toBeUndefined();
      expect(ayuda().props.accessibilityLabel).toBe(
        'Oí «ocho mil quinientos»: puse ocho mil quinientos pesos.',
      );
      expect(campo().props.accessibilityHint).toBe(
        'Oí «ocho mil quinientos»: puse ocho mil quinientos pesos.',
      );
      expect(anunciar).not.toHaveBeenCalled();
    });

    it('iPhone: VoiceOver no lee regiones vivas, así que el resultado se anuncia (solo el final)', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      const { emitir } = montar();
      await tocar();
      emitir({ tipo: 'resultado', texto: 'ocho mil', final: false });
      expect(anunciar).not.toHaveBeenCalled();
      emitir({ tipo: 'resultado', texto: 'ocho mil quinientos', final: true });
      expect(anunciar).toHaveBeenCalledTimes(1);
      expect(anunciar).toHaveBeenCalledWith('Oí «ocho mil quinientos»: puse ocho mil quinientos pesos.');
    });
  });

  it('contrato inyectado: con cualquier `BotonDictar` (sin `voz/`) escribe la cifra que lee `interpretarMonto`', () => {
    const interpretarMonto = jest.fn<ReturnType<LectorMontoDictado>, Parameters<LectorMontoDictado>>(() => ({
      centavos: 0,
      aproximado: false,
    }));
    const BotonDictar = ({ alOir, alAviso, testID }: PropsBotonDictarCampo) => (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Dictar"
        onPress={() => {
          alAviso({ texto: '«no debo»', escuchando: true, sinPermiso: false });
          alAviso(null);
          alOir('no debo nada');
        }}
      />
    );
    const alCambiar = jest.fn();
    render(
      <ContextoDictadoCampos.Provider value={{ BotonDictar, interpretarMonto }}>
        <CampoMonto etiqueta="Deuda" alCambiar={alCambiar} admiteCero testID="monto" />
      </ContextoDictadoCampos.Provider>,
    );
    fireEvent.press(microfono());
    expect(interpretarMonto).toHaveBeenCalledWith('no debo nada', { admiteCero: true });
    expect(campo().props.value).toBe('0');
    expect(alCambiar).toHaveBeenLastCalledWith(0);
    expect(ayuda()).toHaveTextContent('Oí «no debo nada»: puse $0.');
  });

  it('dos campos: el segundo micrófono calla al primero y solo él recibe la cifra', async () => {
    const { motor, emitir, oyentes } = crearMotorFalso();
    const alCambiarA = jest.fn();
    const alCambiarB = jest.fn();
    render(
      <ProveedorDictado motor={motor} leerMonto={leerMonto}>
        <CampoMonto etiqueta="Efectivo" alCambiar={alCambiarA} testID="a" />
        <CampoMonto etiqueta="Tarjeta" alCambiar={alCambiarB} testID="b" />
      </ProveedorDictado>,
    );
    expect(oyentes()).toBe(2);
    await tocar('a-microfono');
    expect(screen.getByTestId('a-microfono').props.accessibilityLabel).toBe(ETIQUETA_ESCUCHANDO);

    await tocar('b-microfono');
    expect(motor.abortar).toHaveBeenCalledTimes(1);
    expect(motor.iniciar).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('a-microfono').props.accessibilityLabel).toBe('Dictar en voz: Efectivo');
    expect(screen.getByTestId('b-microfono').props.accessibilityLabel).toBe(ETIQUETA_ESCUCHANDO);

    // Lo que deja el dictado abortado no corta al nuevo.
    emitir({ tipo: 'error', codigo: 'aborted' });
    emitir({ tipo: 'fin' });
    expect(screen.getByTestId('b-microfono').props.accessibilityLabel).toBe(ETIQUETA_ESCUCHANDO);

    emitir({ tipo: 'inicio' });
    emitir({ tipo: 'resultado', texto: 'ocho mil quinientos', final: true });
    expect(screen.getByTestId('b').props.value).toBe('8,500');
    expect(alCambiarB).toHaveBeenLastCalledWith(850_000);
    expect(screen.getByTestId('a').props.value).toBe('');
    expect(alCambiarA).not.toHaveBeenCalled();
  });
});
