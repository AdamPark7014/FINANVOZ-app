import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useProcesarCola } from '../../nube/useProcesarCola';
import { listarMovimientos, listarPorInterpretar } from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { conEscenario } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { PantallaCuentas } from './PantallaCuentas';
import { PantallaHoy } from './PantallaHoy';
import { PantallaMovimientos } from './PantallaMovimientos';
import { PantallaRegistrar } from './PantallaRegistrar';
import { lineaCambioDia, PISTA_REVISAR_FRASE } from './textos';

const HOY = '2026-10-11';
// Sin verbo y con «micheladas» (fuera del diccionario): el nivel 0 la deja a la nube (06 §9.3).
const TACOS_Y_COCA = 'unas micheladas de 80 con la Nu y una coca de 25 en efectivo';
const TACOS_EN_EFECTIVO = 'no, los tacos fueron en efectivo';

const RESPUESTAS = {
  [TACOS_Y_COCA]: {
    intencion: 'registrar',
    movimientos: [
      {
        tipo: 'gasto',
        monto: 8000,
        fecha: HOY,
        descripcion: 'tacos',
        categoria: 'comida_fuera',
        origen: { tipo: 'credito', alias: 'nu' },
      },
      {
        tipo: 'gasto',
        monto: 2500,
        fecha: HOY,
        descripcion: 'coca',
        categoria: 'antojos',
        origen: { tipo: 'efectivo' },
      },
    ],
  },
  [TACOS_EN_EFECTIVO]: {
    intencion: 'corregir',
    objetivo: { texto: 'tacos' },
    cambios: { origen: { tipo: 'efectivo' } },
  },
};

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

/** Lo que monta la raíz: procesa la cola al reconectar. */
function ColaEnFondo() {
  useProcesarCola();
  return null;
}

function preparar() {
  const p = conEscenario('e4-01');
  const f = nubeFalsa({ ...RESPUESTAS });
  const alRevisar = jest.fn();
  renderConSesion(
    p.ctx,
    <>
      <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />
      <PantallaMovimientos alRegistrar={jest.fn()} alRevisar={alRevisar} />
      <PantallaCuentas />
      <ColaEnFondo />
    </>,
    f.nube,
  );
  return { ...p, ...f, alRevisar };
}

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

describe('Registrar con la nube', () => {
  it('CA-M3-02 y CA-M3-03 · registra dos movimientos, corrige los tacos y Movimientos muestra el historial', async () => {
    const p = preparar();
    const efectivo = p.e.cuentas.efectivo as string;
    const nu = p.e.cuentas.nu as string;

    await escribir(TACOS_Y_COCA);
    // Causa y efecto: la segunda línea dice cómo cambió la cifra de Hoy ($214 de E4-01).
    // Ola 7: el registro es un turno del asistente («Registré…» y debajo cómo cambió tu día).
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(
      'Registré Tacos $80 · Comida fuera · Nu ••4410; Coca $25 · Antojos · Cartera.',
    );
    expect(screen.getByTestId('aviso-cambio')).toHaveTextContent(lineaCambioDia('$214', '$187'));
    expect(textoDe(`cuenta-${nu}-saldo`)).toBe('$2,080');
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$615');

    await escribir(TACOS_EN_EFECTIVO);
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(
      'Corregí: Tacos $80 · Comida fuera · Cartera. Antes: Nu ••4410.',
    );
    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    expect(textoDe(`cuenta-${nu}-saldo`)).toBe('$2,000');
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$535');

    const tacos = listarMovimientos(p.ctx)
      .flatMap((d) => d.movimientos)
      .find((m) => m.descripcion === 'tacos');
    expect(screen.getByText('Comida fuera · corregido')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`movimiento-${tacos?.id}`));
    const historial = screen.getByTestId(`historial-${tacos?.id}`);
    expect(within(historial).getByText('Lo corregiste. Antes:')).toBeTruthy();
    expect(within(historial).getByText('Tacos $80 · Comida fuera · Nu ••4410 · 11 oct')).toBeTruthy();
  });

  it('varias coincidencias: tarjeta para elegir cuál corregir', async () => {
    const p = preparar();
    await escribir(TACOS_Y_COCA);
    await escribir('tacos 120 con la morada');
    await escribir(TACOS_EN_EFECTIVO);
    const tarjeta = screen.getByTestId('tarjeta-elegir');
    expect(within(tarjeta).getByText('¿Cuál quieres corregir?')).toBeTruthy();
    expect(screen.getByTestId('boton-guardar-eleccion').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    const viejo = listarMovimientos(p.ctx)
      .flatMap((d) => d.movimientos)
      .find((m) => m.monto === 8000);
    fireEvent.press(within(tarjeta).getByTestId(`elegir-movimiento-${viejo?.id}`));
    fireEvent.press(screen.getByTestId('boton-guardar-eleccion'));
    expect(screen.queryByTestId('tarjeta-elegir')).toBeNull();
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(/^Corregí: Tacos \$80/);
  });

  it('aclarar: una pregunta con opciones; elegir una vuelve a interpretar la frase', async () => {
    const p = preparar();
    p.responder('gasté dos cincuenta en un chicle', {
      intencion: 'aclarar',
      motivo: 'monto_ambiguo',
      pregunta: '¿Fueron $2.50 o $250?',
      opciones: ['$2.50', '$250'],
    });
    p.responder('gasté dos cincuenta en un chicle, $2.50', {
      intencion: 'registrar',
      movimientos: [
        { tipo: 'gasto', monto: 250, fecha: HOY, descripcion: 'chicle', origen: { tipo: 'efectivo' } },
      ],
    });
    await escribir('gasté dos cincuenta en un chicle');
    // Ola 7: «aclarar» es una pregunta del asistente con las opciones como chips.
    expect(screen.getByTestId('pregunta-texto')).toHaveTextContent('¿Fueron $2.50 o $250?');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pregunta-chip-$2.50'));
    });
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(
      'Registré Chicle $2.50 · Otros gastos · Cartera.',
    );
    expect(screen.getByTestId('aviso-cambio')).toHaveTextContent(lineaCambioDia('$214', '$213'));
  });

  it('CA-M3-05 · sin internet la frase espera con un indicador discreto y se procesa al reconectar', async () => {
    const p = preparar();
    p.desconectar();
    await escribir(TACOS_Y_COCA);
    // Con intérprete en internet y sin red: el texto honesto con chips para resolverlo ya (Ola 7).
    expect(screen.getByTestId('pregunta-texto')).toHaveTextContent(
      /^Lo guardé; lo interpreto cuando tengas internet\./,
    );
    expect(screen.getByTestId('pregunta-chip-gasto')).toBeTruthy();
    expect(textoDe('indicador-esperando-conexion')).toBe('1 frase espera internet para interpretarla.');
    expect(listarMovimientos(p.ctx)).toEqual([]);

    await act(async () => {
      p.reconectar();
    });
    await waitFor(() => expect(screen.queryByTestId('indicador-esperando-conexion')).toBeNull());
    expect(listarPorInterpretar(p.ctx)).toEqual([]);
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toHaveLength(2);
    expect(screen.getByText('tacos')).toBeTruthy();
  });

  it('una frase que la nube entendió pero necesita confirmación lleva "Revisar" y se confirma en Registrar', async () => {
    const p = preparar();
    p.desconectar();
    // Sin verbo y con «micheladas»: el nivel 0 la deja a la nube (06 §9.3); la nube contesta un monto alto.
    p.responder('anoche unas micheladas de 6,000 con la morada', {
      intencion: 'registrar',
      movimientos: [
        {
          tipo: 'gasto',
          monto: 600_000,
          fecha: '2026-10-10',
          descripcion: 'tele',
          origen: { tipo: 'credito', alias: 'morada' },
        },
      ],
    });
    await escribir('anoche unas micheladas de 6,000 con la morada');
    await act(async () => {
      p.reconectar();
    });
    const [frase] = listarPorInterpretar(p.ctx);
    expect(await screen.findByTestId(`revisar-${frase?.id}`)).toHaveProp(
      'accessibilityHint',
      PISTA_REVISAR_FRASE,
    );
    fireEvent.press(screen.getByTestId(`revisar-${frase?.id}`));
    expect(p.alRevisar).toHaveBeenCalledWith(frase?.id);

    // Registrar abierto con esa frase.
    screen.unmount();
    renderConSesion(
      p.ctx,
      <PantallaRegistrar alCerrar={jest.fn()} fraseRevision={frase?.id as string} />,
      p.nube,
    );
    // Ola 7: la frase revisada llega como «Entendí» (monto alto) y «Sí, regístralo» la guarda.
    await screen.findByTestId('entendi');
    expect(screen.getByTestId('entendi-efecto')).toHaveTextContent(
      'Es un monto alto. Revísalo antes de guardar.',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(
      'Registré Tele $6,000 · Otros gastos · Nu ••4410.',
    );
    expect(listarPorInterpretar(p.ctx)).toEqual([]);
  });

  it('fuera de alcance y consultas sin vista responden con una frase, sin registrar nada', async () => {
    const p = preparar();
    p.responder('transfiéreme 500 a juan', { intencion: 'fuera_de_alcance', motivo: 'mueve_dinero' });
    await escribir('transfiéreme 500 a juan');
    expect(textoDe('respuesta-texto')).toBe('No muevo dinero por ti: solo llevo la cuenta de lo que pasa.');
    p.responder('cuánto puedo deducir', {
      intencion: 'consultar',
      consulta: { tipo: 'deducciones' },
    });
    await escribir('cuánto puedo deducir');
    expect(textoDe('respuesta-texto')).toBe('Todavía no sé responder esa pregunta.');
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });
});
