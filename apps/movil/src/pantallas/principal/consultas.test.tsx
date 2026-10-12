import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { registrarMovimiento, listarCuentas } from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { activarPlus, conEscenario, golden } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { filtroDeParams, paramsDeFiltro } from './filtroRuta';
import { PantallaHoy } from './PantallaHoy';
import { PantallaMovimientos } from './PantallaMovimientos';

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

function preparar({ plus = true }: { plus?: boolean } = {}) {
  const p = conEscenario('e4-01');
  if (plus) activarPlus(p.ctx);
  const f = nubeFalsa();
  for (const id of ['Q01', 'Q02', 'Q04', 'Q06']) f.responder(golden(id).texto, golden(id).esperado);
  const navegacion = navegacionFalsa();
  renderConSesion(p.ctx, <PantallaHoy navegacion={navegacion} motor={crearMotorFalso().motor} />, f.nube);
  return { ...p, ...f, navegacion };
}

describe('consultas tipadas en Hoy (RF-CON-01, CA-M7-03)', () => {
  it('Q01 responde al instante con la plantilla de Hoy puedes', async () => {
    const p = preparar();
    await escribir(golden('Q01').texto);
    expect(screen.getByTestId('respuesta-consulta-texto')).toHaveTextContent(
      'Hoy puedes gastar $214; faltan 4 días para tu quincena.',
    );
    expect(p.recibidas).toHaveLength(0);
  });

  it('en Gratis una consulta de Plus lo dice sin cifras ni "Ver movimientos"', async () => {
    preparar({ plus: false });
    await escribir(golden('Q04').texto);
    expect(await screen.findByTestId('respuesta-consulta-texto')).toHaveTextContent(
      'Responder preguntas sobre tu dinero es parte de Plus. Tu «hoy puedes» sigue en tu plan.',
    );
    expect(screen.queryByTestId('boton-ver-movimientos-consulta')).toBeNull();
  });

  it('Q04 responde el saldo y "Ver movimientos" abre Movimientos filtrado por la cuenta', async () => {
    const p = preparar();
    await escribir(golden('Q04').texto);
    expect(await screen.findByTestId('respuesta-consulta-texto')).toHaveTextContent(
      'En BBVA Débito tienes $3,590.',
    );
    fireEvent.press(screen.getByTestId('boton-ver-movimientos-consulta'));
    const bbva = listarCuentas(p.ctx).tienes.find((c) => c.nombre.startsWith('BBVA'))?.id;
    expect(p.navegacion.alVerMovimientos).toHaveBeenCalledWith({ cuentaId: bbva });
  });

  it('Q06 lista los pagos con su fecha; "Listo" cierra la respuesta', async () => {
    preparar();
    await escribir(golden('Q06').texto);
    expect(await screen.findByTestId('respuesta-consulta-texto')).toHaveTextContent(
      'En los próximos 7 días tienes 2 pagos por $1,174.',
    );
    const lineas = screen.getByTestId('respuesta-consulta-lineas');
    expect(within(lineas).getByText('tanda · mar 13 oct')).toBeTruthy();
    expect(within(lineas).getByText('$674')).toBeTruthy();
    fireEvent.press(screen.getByText('Listo'));
    expect(screen.queryByTestId('respuesta-consulta')).toBeNull();
  });
});

describe('Movimientos con el filtro de una consulta', () => {
  it('muestra solo lo que suma en la respuesta y "Ver todos" quita el filtro', async () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    const efectivo = listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Cartera')?.id as string;
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 8_000,
      categoria: 'comida_fuera',
      origenId: efectivo,
      descripcion: 'tacos',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 12_000,
      categoria: 'transporte',
      origenId: efectivo,
      descripcion: 'uber',
    });
    const f = nubeFalsa({ [golden('Q02').texto]: golden('Q02').esperado });
    // El filtro viaja por la ruta y vuelve igual.
    const ruta = paramsDeFiltro({
      desde: '2026-10-05',
      hasta: '2026-10-11',
      soloGastos: true,
      categorias: ['comida_fuera', 'antojos', 'super'],
    });
    expect(ruta).toEqual({
      desde: '2026-10-05',
      hasta: '2026-10-11',
      categorias: 'comida_fuera,antojos,super',
      gastos: '1',
    });
    const filtro = filtroDeParams(ruta);
    const alQuitarFiltro = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaMovimientos alRegistrar={jest.fn()} filtro={filtro} alQuitarFiltro={alQuitarFiltro} />,
      f.nube,
    );
    expect(screen.getByTestId('movimientos-filtro')).toBeTruthy();
    expect(screen.getByText(/tacos/i)).toBeTruthy();
    expect(screen.queryByText(/uber/i)).toBeNull();
    fireEvent.press(screen.getByTestId('boton-quitar-filtro'));
    expect(alQuitarFiltro).toHaveBeenCalled();
    expect(filtroDeParams({})).toBeNull();
    expect(filtroDeParams({ desde: 'ayer', categorias: 'DROP TABLE' })).toBeNull();
  });
});
