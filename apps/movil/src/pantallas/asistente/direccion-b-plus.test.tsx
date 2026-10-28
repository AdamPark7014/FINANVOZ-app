import { fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { obtenerHoy } from '../../servicios';
import { coloresDinero, formatearCentavos } from '../../ui';
import { auditar } from '../__pruebas__/accesibilidad';
import { conEscenario } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaAsistente } from './PantallaAsistente';
import { reiniciarR2 } from './r2';
import { etiquetaDiaPista, lineasEventoPista, nombreCorto, partesDinero, textoDiasPista } from './textos';

jest.mock('expo-speech', () => ({
  speak: jest.fn((_texto: string, o?: { onDone?: () => void }) => o?.onDone?.()),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

const fondo = (testID: string) =>
  (StyleSheet.flatten(screen.getByTestId(testID).props.style) as { backgroundColor?: string })
    .backgroundColor;

function montar(escenario = 'e4-01') {
  const p = conEscenario(escenario);
  const { motor } = crearMotorFalso();
  renderConSesion(
    p.ctx,
    <PantallaAsistente navegacion={{ ...navegacionFalsa(), alAbrirR2: jest.fn() }} motor={motor} />,
  );
  return p;
}

beforeEach(() => reiniciarR2());

describe('B+ · textos del inicio (D1)', () => {
  it('la barra de tu dinero es el desglose de E4: apartado + colchón + libre = lo que tienes', () => {
    const v = { liquidez: 524_900, reservado: 284_900, colchon: 130_000, libre: 110_000 };
    const { total, partes } = partesDinero(v);
    expect(total).toBe(524_900);
    expect(partes.map((p) => [p.etiqueta, p.centavos])).toEqual([
      ['Apartado', 284_900],
      ['Colchón', 130_000],
      ['Libre', 110_000],
    ]);
    expect(partes.reduce((s, p) => s + p.centavos, 0)).toBe(total);
    // Libre negativo: se ve en cero (el faltante lo dice la frase de arriba); nada infla lo libre.
    expect(partesDinero({ ...v, libre: -37_400 }).partes[2]?.centavos).toBe(0);
  });

  it('la pista: insignia, eventos y lo que oye el lector', () => {
    expect(textoDiasPista(4)).toBe('4 días');
    expect(textoDiasPista(1)).toBe('1 día');
    expect(textoDiasPista(0)).toBe('Hoy');
    expect(nombreCorto('Nu ••4410')).toBe('Nu');
    expect(lineasEventoPista({ tipo: 'egreso', concepto: 'internet', monto: 49_900 })).toEqual({
      concepto: 'Internet',
      cifra: '−$499',
    });
    expect(lineasEventoPista({ tipo: 'ingreso', concepto: 'quincena', monto: 1_300_000 })).toEqual({
      concepto: 'Quincena',
      cifra: '+$13,000',
    });
    expect(lineasEventoPista({ tipo: 'tarjeta', concepto: 'Nu ••4410', monto: 142_000 })).toEqual({
      concepto: 'Pagar Nu',
      cifra: null,
    });
    expect(etiquetaDiaPista({ hoy: true, diaSemana: 'lun', dia: 26, eventos: [] })).toBe(
      'Hoy, lunes 26: nada fijo.',
    );
    expect(
      etiquetaDiaPista({
        hoy: false,
        diaSemana: 'jue',
        dia: 29,
        eventos: [
          { tipo: 'egreso', concepto: 'tanda', monto: 50_000 },
          { tipo: 'tarjeta', concepto: 'Nu', monto: 142_000 },
        ],
      }),
    ).toBe('Jueves 29: tanda, menos quinientos pesos; pagar Nu, mil cuatrocientos veinte pesos.');
  });
});

describe('B+ · Inicio «Tablero vivo» (D1)', () => {
  it('orbe y saludo, la cifra con «al día», la barra de tu dinero y la pista a la quincena', () => {
    const p = montar();
    const v = obtenerHoy(p.ctx);
    expect(within(screen.getByTestId('cabecera-dia')).getByTestId('orbe')).toBeTruthy();
    expect(screen.getByTestId('hoy-puedes')).toHaveTextContent('$214');
    expect(screen.getByText('al día')).toBeTruthy();
    // Tu dinero: «De tus $X» y cada parte con su cifra (las de E4 en VistaHoy).
    expect(screen.getByTestId('barra-dinero-total')).toHaveTextContent(
      `De tus ${formatearCentavos(v.liquidez, 'pesos')}`,
    );
    expect(screen.getByTestId('barra-dinero-apartado')).toHaveTextContent(
      `Apartado${formatearCentavos(v.reservado, 'pesos')}`,
    );
    expect(screen.getByTestId('barra-dinero-colchon')).toHaveTextContent(
      `Colchón${formatearCentavos(v.colchon, 'pesos')}`,
    );
    expect(screen.getByTestId('barra-dinero-libre')).toHaveTextContent(
      `Libre${formatearCentavos(v.libre, 'pesos')}`,
    );
    expect(fondo('barra-dinero-barra-apartado')).toBe(coloresDinero.claro.apartado);
    expect(fondo('barra-dinero-barra-libre')).toBe(coloresDinero.claro.libre);
    // La pista: de hoy (dom 11) a la quincena (jue 15) con la tanda y el internet.
    expect(screen.getByTestId('pista-dias')).toHaveTextContent('4 días');
    expect(screen.getByTestId('pista-dia-2026-10-11').props.accessibilityLabel).toBe(
      'Hoy, domingo 11: nada fijo.',
    );
    expect(screen.getByTestId('pista-dia-2026-10-13')).toHaveTextContent('MAR13Tanda−$500');
    expect(screen.getByTestId('pista-dia-2026-10-15')).toHaveTextContent('JUE15Quincena+$6,500');
    // «Cómo lo calculé ›» sigue abriendo y cerrando el desglose (Maestro 02 y 09).
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.getByTestId('desglose')).toBeTruthy();
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.queryByTestId('desglose')).toBeNull();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });

  it('lo pendiente de una tarjeta es una fila con su mosaico, qué pagar y «Ya la pagué» (vencida, sin prometer)', () => {
    const p = conEscenario('e5-10');
    p.reloj.fijar('2026-11-28');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const fila = screen.getByTestId('tarjeta-accion-0');
    expect(within(fila).getByTestId('tarjeta-accion-0-texto').props.accessibilityLabel).toMatch(
      /^La fecha límite de tu .+ fue el .+\. Pago para no generar intereses: .+ pesos\.$/,
    );
    expect(within(fila).getByTestId('tarjeta-accion-0-ya-la-pague')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });
});
