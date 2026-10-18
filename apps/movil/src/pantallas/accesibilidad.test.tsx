import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, screen } from '@testing-library/react-native';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { cargarEscenario, registrarMovimiento } from '../servicios';
import { auditar, ordenDeLectura } from './__pruebas__/accesibilidad';
import { PantallaArqueo } from './arqueo/PantallaArqueo';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './principal/__pruebas__/arnes';
import { abrirPruebaPantalla, conEscenario, escenario } from './principal/__pruebas__/base';
import { PantallaHoy } from './principal/PantallaHoy';
import { PantallaRegistrar } from './principal/PantallaRegistrar';

/**
 * CA-M7-05 (`02 §15`, RNF-08): Hoy, registro y arqueo se pueden recorrer con TalkBack (cada cifra en palabras,
 * todo lo tocable con rol y nombre) y con texto al 200 % ninguna cifra se corta (nada trunca ni fija tamaños).
 * El recorrido real con TalkBack en el teléfono queda en ESTADO (pendiente de dispositivo).
 */

const sinHallazgos = () => expect(auditar(screen.toJSON())).toEqual([]);

describe('accesibilidad (CA-M7-05)', () => {
  it('ningún componente de la app usa propiedades que truncan o fijan el tamaño del texto', () => {
    const raiz = join(__dirname, '..', '..');
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) {
          if (nombre !== 'node_modules' && nombre !== '__pruebas__') recorrer(ruta);
        } else if (/\.tsx$/.test(nombre) && !/\.test\.tsx$/.test(nombre)) archivos.push(ruta);
      }
    };
    recorrer(join(raiz, 'src'));
    recorrer(join(raiz, 'app'));
    expect(archivos.length).toBeGreaterThan(30);
    const prohibidas =
      /numberOfLines|ellipsizeMode|adjustsFontSizeToFit|allowFontScaling=\{false\}|maxFontSizeMultiplier/;
    const conProblema = archivos.filter((a) => prohibidas.test(readFileSync(a, 'utf8')));
    expect(conProblema).toEqual([]);
  });

  it('Hoy (e4-01): la cifra principal se lee primero, en palabras, y el desglose agrupa concepto y monto', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    sinHallazgos();
    fireEvent.press(screen.getByTestId('boton-desglose'));
    sinHallazgos();

    const orden = ordenDeLectura(screen.toJSON());
    const i = (t: string | RegExp) => orden.findIndex((x) => (typeof t === 'string' ? x === t : t.test(x)));
    expect(i('Dom 11 oct')).toBe(0);
    expect(i('Hoy puedes gastar doscientos catorce pesos')).toBeGreaterThan(i('Dom 11 oct'));
    expect(i('4 días para tu quincena (jue 15)')).toBeGreaterThan(
      i('Hoy puedes gastar doscientos catorce pesos'),
    );
    expect(i(/^Ocultar desglose$/)).toBeGreaterThan(i('4 días para tu quincena (jue 15)'));
    expect(i('Libre: ochocientos cincuenta y seis pesos')).toBeGreaterThan(i(/^Ocultar desglose$/));
    expect(i('Toca para hablar')).toBeGreaterThan(i('Libre: ochocientos cincuenta y seis pesos'));
    // Cada fila del desglose es un solo elemento: concepto y monto juntos, sin repetir.
    expect(orden.filter((x) => x.startsWith('Colchón'))).toHaveLength(1);
    p.cerrar();
  });

  it('Hoy con tarjetas de acción (arqueo pendiente) se lee completo', () => {
    const p = conEscenario('e4-01');
    const INICIO = Date.UTC(2026, 9, 11, 16, 0);
    p.reloj.fijarInstante(INICIO);
    registrarMovimiento(p.ctx, {
      tipo: 'retiro_efectivo',
      origenId: p.e.cuentas['bbva'] as string,
      destinoId: p.e.cuentas['efectivo'] as string,
      monto: 50_000,
    });
    p.reloj.fijarInstante(INICIO + 49 * 3_600_000);
    renderConSesion(
      p.ctx,
      <PantallaHoy
        navegacion={{ ...navegacionFalsa(), alAbrirArqueo: jest.fn() }}
        motor={crearMotorFalso().motor}
      />,
    );
    expect(screen.getByText('Deberías traer $1,140 en efectivo. ¿Cuánto traes?')).toHaveProp(
      'accessibilityLabel',
      'Deberías traer mil ciento cuarenta pesos en efectivo. ¿Cuánto traes?',
    );
    sinHallazgos();
    p.cerrar();
  });

  it('registro: panel, formulario, confirmación de monto alto y aviso de "Deshacer"', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} motor={crearMotorFalso().motor} />);
    sinHallazgos();

    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'renta 6000 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    expect(screen.getByTestId('confirmacion-registro')).toBeTruthy();
    sinHallazgos();
    fireEvent.press(screen.getByTestId('boton-cancelar-confirmacion'));

    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'tacos 80 con tarjeta');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    sinHallazgos();
    fireEvent.press(screen.getByTestId('boton-cancelar-confirmacion'));

    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'coca 25 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    expect(screen.getByTestId('aviso')).toBeTruthy();
    sinHallazgos();
    p.cerrar();
  });

  it('arqueo: paso 1 con casillas, cifra esperada, reparto del faltante y sobrante', () => {
    const p = abrirPruebaPantalla();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const INICIO = Date.UTC(2026, 9, 11, 16, 0);
    p.reloj.fijarInstante(INICIO - 30 * 3_600_000);
    const efectivo = e.cuentas['efectivo'] as string;
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'comida_fuera',
      origenId: efectivo,
      monto: 12_000,
      fecha: '2026-10-05',
    });
    const coca = registrarMovimiento(
      p.ctx,
      {
        tipo: 'gasto',
        categoria: 'antojos',
        origenId: CUENTAS_SISTEMA.porAsignar,
        monto: 2_500,
        descripcion: 'Coca',
        fecha: '2026-10-10',
      },
      { origen: 'voz' },
    );
    p.reloj.fijarInstante(INICIO);
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    sinHallazgos();
    fireEvent.press(screen.getByTestId(`arqueo-marcar-${coca.transaccionId}`));
    sinHallazgos();
    fireEvent.press(screen.getByTestId('arqueo-continuar'));
    sinHallazgos();
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '300');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByText(/^Faltan \$/)).toBeTruthy();
    sinHallazgos();
    fireEvent.press(screen.getByTestId('arqueo-confirmar'));
    sinHallazgos();
    p.cerrar();
  });

  it('arqueo con sobrante pregunta de dónde salió con opciones accesibles', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '700');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByText('Traes $60 más de lo esperado. ¿De dónde salió?')).toBeTruthy();
    sinHallazgos();
    p.cerrar();
  });
});
