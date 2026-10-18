import { act, fireEvent, screen } from '@testing-library/react-native';
import type { NivelNube } from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { pide, responde, turnoGuionado, type PasoGuion } from '../../servicios/__pruebas__/turno';
import { activarPlus, conEscenario, golden } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { PantallaHoy } from './PantallaHoy';

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

/** Semilla `e4-01` (hoy puedes $214; tanda $500 el 13 oct e internet $674 el 14 oct) con Q13 en la nube. */
function preparar(guion: PasoGuion[], { plus = true }: { plus?: boolean } = {}) {
  const p = conEscenario('e4-01');
  if (plus) activarPlus(p.ctx);
  const f = nubeFalsa({ [golden('Q13').texto]: golden('Q13').esperado });
  const t = turnoGuionado(guion);
  const nube: NivelNube = { ...f.nube, turno: t.cliente };
  const navegacion = navegacionFalsa();
  renderConSesion(p.ctx, <PantallaHoy navegacion={navegacion} motor={crearMotorFalso().motor} />, nube);
  return { ...p, ...t, navegacion };
}

const CONSULTAS: PasoGuion = pide(['hoy'], ['compromisos', { desde: '2026-10-11', hasta: '2026-10-17' }]);

describe('modo explicar en el panel Registrar (02 §22, RF-CON-02)', () => {
  it('Q13 muestra la explicación con sus cifras, "Ver movimientos ›" y el pie fijo', async () => {
    const p = preparar([
      CONSULTAS,
      responde('Hoy puedes gastar $214 porque en los próximos 7 días tienes 2 pagos por $1,174.'),
    ]);
    await escribir(golden('Q13').texto);
    expect(await screen.findByTestId('explicacion-texto')).toHaveTextContent(
      'Hoy puedes gastar $214 porque en los próximos 7 días tienes 2 pagos por $1,174.',
    );
    expect(screen.getByTestId('explicacion-pie')).toHaveTextContent(
      'Responde con tus datos; no es asesoría financiera.',
    );
    fireEvent.press(screen.getByTestId('boton-ver-movimientos-explicar'));
    expect(p.navegacion.alVerMovimientos).toHaveBeenCalledWith({ desde: '2026-10-11', hasta: '2026-10-17' });
    fireEvent.press(screen.getByText('Listo'));
    expect(screen.queryByTestId('respuesta-explicar')).toBeNull();
  });

  it('con una cifra inventada muestra "No pude explicarlo mejor" y las respuestas en plantilla', async () => {
    preparar([CONSULTAS, responde('Hoy puedes gastar $300 porque tus pagos suben.')]);
    await escribir(golden('Q13').texto);
    const plantilla = await screen.findByTestId('explicacion-plantilla');
    expect(plantilla).toHaveTextContent('No pude explicarlo mejor', { exact: false });
    expect(plantilla).toHaveTextContent('Hoy puedes gastar $214; faltan 4 días para tu quincena.', {
      exact: false,
    });
    expect(plantilla).toHaveTextContent('En los próximos 7 días tienes 2 pagos por $1,174.', {
      exact: false,
    });
    expect(screen.queryByText(/\$300/)).toBeNull();
    expect(screen.getByTestId('explicacion-pie')).toBeTruthy();
  });

  it('en Gratis ofrece Plus sin preguntarle nada al modelo', async () => {
    const p = preparar([], { plus: false });
    await escribir(golden('Q13').texto);
    expect(await screen.findByTestId('explicacion-solo-plus')).toHaveTextContent(
      'Preguntarme lo que quieras sobre tu dinero es parte de Plus. Tu «hoy puedes» sigue en tu plan.',
    );
    expect(p.vueltas).toHaveLength(0);
    expect(screen.queryByTestId('explicacion-pie')).toBeNull();
  });

  it('sin internet lo dice', async () => {
    preparar([{ tipo: 'sin_red' }]);
    await escribir(golden('Q13').texto);
    expect(await screen.findByTestId('mensaje-registro')).toHaveTextContent(
      'Necesito internet para responderte eso. Pregúntame de nuevo cuando tengas conexión.',
    );
  });

  it('con cupo agotado muestra el aviso en la tarjeta explicar, sin Por revisar', async () => {
    preparar([{ tipo: 'limite', codigo: 'limite_mensual' }]);
    await escribir(golden('Q13').texto);
    const limite = await screen.findByTestId('explicacion-limite');
    expect(limite).toHaveTextContent('No pude responderte esta pregunta', { exact: false });
    expect(limite).not.toHaveTextContent('Por revisar');
    expect(screen.queryByTestId('explicacion-pie')).toBeNull();
  });
});
