import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { listarMovimientos } from '../../servicios';
import { DURACION_AVISO_MS } from '../../ui';
import { auditar } from '../__pruebas__/accesibilidad';
import { notificacionesEnMemoria, ProveedorNotificaciones } from '../avisos/notificaciones';
import { conEscenario } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaAsistente } from './PantallaAsistente';
import { reiniciarR2 } from './r2';
import {
  filasCalculo,
  pistaCorregirRegistro,
  saludoPorHora,
  separarCambioDia,
  textoHastaIngreso,
  textoPildoraDia,
  unirConY,
} from './textos';

jest.mock('expo-speech', () => ({
  speak: jest.fn((_texto: string, o?: { onDone?: () => void }) => o?.onDone?.()),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

const movimientos = (ctx: Parameters<typeof listarMovimientos>[0]) =>
  listarMovimientos(ctx).flatMap((d) => d.movimientos);

function montar(notificaciones: ReturnType<typeof notificacionesEnMemoria> | null = null) {
  const p = conEscenario('e4-01');
  const { motor } = crearMotorFalso();
  renderConSesion(
    p.ctx,
    <ProveedorNotificaciones notificaciones={notificaciones}>
      <PantallaAsistente navegacion={{ ...navegacionFalsa(), alAbrirR2: jest.fn() }} motor={motor} />
    </ProveedorNotificaciones>,
  );
  return p;
}

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

beforeEach(() => reiniciarR2());

describe('Dirección B · textos (02 §4)', () => {
  it('saludo por hora, hasta cuándo, la píldora y las partes de «Tu día pasa de…»', () => {
    expect(saludoPorHora(7)).toBe('Buenos días');
    expect(saludoPorHora(13)).toBe('Buenas tardes');
    expect(saludoPorHora(22)).toBe('Buenas noches');
    expect(saludoPorHora(3)).toBe('Buenas noches');
    const vista = {
      estado: 'normal',
      estadoHorizonte: 'normal',
      proximoIngreso: { concepto: 'quincena', fecha: '2026-10-30', etiqueta: 'vie 30' },
      dias: 4,
      faltante: 0,
    } as const;
    expect(textoHastaIngreso(vista)).toBe('hasta tu quincena del vie 30, en 4 días.');
    expect(textoHastaIngreso({ ...vista, dias: 1 })).toBe('hasta tu quincena del vie 30, en 1 día.');
    expect(textoHastaIngreso({ ...vista, estadoHorizonte: 'dia_de_pago' })).toBeNull();
    expect(textoPildoraDia(vista)).toBe('Hoy puedes gastar · hasta el vie 30');
    expect(textoPildoraDia({ ...vista, estado: 'libre_negativo', faltante: 37_400 })).toBe(
      'Hoy te faltan $374',
    );
    expect(separarCambioDia('Tu día pasa de $275 a $268.')).toEqual({
      antes: 'Tu día pasa de $275 a ',
      despues: '$268',
      final: '.',
    });
    expect(separarCambioDia('Deshice el registro.')).toBeNull();
    expect(unirConY(['Nu', 'internet', 'tanda'])).toBe('Nu, internet y tanda');
    expect(unirConY(['efectivo'])).toBe('efectivo');
    expect(pistaCorregirRegistro('Nu')).toBe('Si oí mal, solo dime «eran 30» o «fue con Nu».');
  });

  it('«Cómo lo calculé» de una compra: tienes − reservado − colchón − la compra = libre entre los días', () => {
    const filas = filasCalculo({
      tienes: { monto: 522_400, nombres: ['efectivo', 'BBVA'] },
      reservado: { monto: 284_900, nombres: ['Nu', 'internet', 'tanda'] },
      colchon: 130_000,
      compra: { que: 'los tenis', precio: 50_000 },
      libre: 57_500,
      dias: 4,
      alDia: 14_375,
    });
    expect(filas.map((f) => [f.etiqueta, f.valor])).toEqual([
      ['Tienes en efectivo y BBVA', '$5,224'],
      ['Reservado: Nu, internet y tanda', '−$2,849'],
      ['Colchón', '−$1,300'],
      ['Los tenis', '−$500'],
      ['Libre $575 entre 4 días', '$143 al día'],
    ]);
  });
});

describe('Dirección B · Asistente (B1–B3)', () => {
  it('B2: tras registrar, la píldora con la cifra del día sustituye al reposo y abre «Cómo lo calculé»', async () => {
    const p = montar();
    expect(screen.getByTestId('reposo')).toBeTruthy();
    await escribir('coca 25 en efectivo');
    expect(screen.queryByTestId('reposo')).toBeNull();
    const pildora = screen.getByTestId('boton-desglose');
    expect(pildora).toHaveTextContent('Hoy puedes gastar · hasta el jue 15$207');
    expect(pildora.props.accessibilityLabel).toBe(
      'Hoy puedes gastar, hasta el jue 15: doscientos siete pesos',
    );
    fireEvent.press(pildora);
    expect(screen.getByTestId('desglose')).toBeTruthy();
    // Lo que dijiste va en burbuja; abajo de la tarjeta, cómo corregir hablando.
    expect(screen.getByText('coca 25 en efectivo')).toBeTruthy();
    expect(screen.getByTestId('aviso-pista')).toHaveTextContent(/^Si oí mal, solo dime «eran 30»/);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });

  it('los chips de un toque corrigen categoría, cuenta y día (anula y registra) y la tarjeta dice «Listo, lo corregí.»', async () => {
    const p = montar();
    await escribir('coca 25 en efectivo');
    const [original] = movimientos(p.ctx);
    // Categoría: tocar el chip abre las opciones y elegir otra corrige el movimiento.
    fireEvent.press(screen.getByTestId('aviso-chip-categoria'));
    expect(screen.getByTestId('aviso-chip-categoria').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByTestId('aviso-opcion-categoria-antojos').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('aviso-opcion-categoria-comida_fuera'));
    });
    let [vigente] = movimientos(p.ctx);
    expect(movimientos(p.ctx)).toHaveLength(1);
    expect(vigente?.categoriaSlug).toBe('comida_fuera');
    expect(vigente?.reemplazaA).toBe(original?.id);
    expect(screen.getByText('Listo, lo corregí.')).toBeTruthy();
    expect(screen.getByTestId('aviso-chip-categoria')).toHaveTextContent('Comida fuera');
    // Cuenta: de Cartera (efectivo) a BBVA.
    fireEvent.press(screen.getByTestId('aviso-chip-cuenta'));
    await act(async () => {
      fireEvent.press(screen.getByTestId(`aviso-opcion-cuenta-${p.e.cuentas['bbva'] as string}`));
    });
    [vigente] = movimientos(p.ctx);
    expect(vigente?.saleDe).toEqual(['BBVA Débito ••5521']);
    // Día: ayer.
    fireEvent.press(screen.getByTestId('aviso-chip-dia'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('aviso-opcion-dia-2026-10-10'));
    });
    [vigente] = movimientos(p.ctx);
    expect(vigente?.fecha).toBe('2026-10-10');
    expect(screen.getByTestId('aviso-chip-dia')).toHaveTextContent('Ayer');
    p.cerrar();
  });

  it('«Deshacer» lleva su anillo y se va a los 10 s; con lector de pantalla se queda', async () => {
    jest.useFakeTimers();
    try {
      const p = montar();
      await escribir('coca 25 en efectivo');
      expect(screen.getByTestId('aviso-deshacer')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(DURACION_AVISO_MS + 500);
      });
      expect(screen.queryByTestId('aviso-deshacer')).toBeNull();
      p.cerrar();
    } finally {
      jest.useRealTimers();
    }
    const lector = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const q = montar();
    await escribir('coca 25 en efectivo');
    await act(async () => {});
    jest.useFakeTimers();
    try {
      await act(async () => {
        jest.advanceTimersByTime(DURACION_AVISO_MS + 500);
      });
      expect(screen.getByTestId('aviso-deshacer')).toBeTruthy();
    } finally {
      jest.useRealTimers();
      // Sin restaurar: el simulacro de react-native quedaría sin promesa; se deja como estaba (sin lector).
      lector.mockResolvedValue(false);
    }
    q.cerrar();
  });

  it('B3: «¿me alcanza?» con las dos opciones, «Cómo lo calculé» y «Recuérdamelo el jue 15» programa el aviso', async () => {
    const n = notificacionesEnMemoria();
    const p = montar(n);
    await escribir('¿me alcanza para unos tenis de 100?');
    const turno = screen.getAllByTestId(/^turno-puedo-gastar-\d+$/)[0] as never;
    expect(within(turno).getByTestId(/-opcion-contado$/)).toHaveTextContent(/Te quedan \$756 libres/);
    expect(
      within(turno).getByText('Te digo qué pasa con tu dinero; no es asesoría financiera.'),
    ).toBeTruthy();
    expect(within(turno).getByTestId(/-registrar$/)).toHaveTextContent('Lo compré');
    await act(async () => {
      fireEvent.press(within(turno).getByTestId(/-recordar$/));
    });
    expect((await n.puerto.programadas()).map((a) => a.id)).toEqual(['me-alcanza:2026-10-15']);
    expect(within(turno).getByTestId(/-recordado$/)).toHaveTextContent('Te lo recuerdo el jue 15.');
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });
});
