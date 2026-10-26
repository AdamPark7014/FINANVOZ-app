import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { cargarEscenario, registrarMovimiento } from '../servicios';
import { auditar, ordenDeLectura } from './__pruebas__/accesibilidad';
import { PantallaArqueo } from './arqueo/PantallaArqueo';
import { PantallaR2 } from './asistente/PantallaR2';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './principal/__pruebas__/arnes';
import { abrirPruebaPantalla, conEscenario, escenario } from './principal/__pruebas__/base';
import { PantallaHoy } from './principal/PantallaHoy';

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
    // Ola 7 (cabecera del asistente): la cifra principal va primero, después la fecha y los días; la barra del día
    // (que abre y cierra el desglose) se lee entera, con sus tres partes en palabras.
    expect(i('Hoy puedes gastar doscientos catorce pesos')).toBe(0);
    expect(i('Dom 11 oct')).toBeGreaterThan(i('Hoy puedes gastar doscientos catorce pesos'));
    expect(i('4 días para tu quincena (jue 15)')).toBeGreaterThan(i('Dom 11 oct'));
    const barra = i(/^Reservado .*, libre ochocientos cincuenta y seis pesos$/);
    expect(barra).toBeGreaterThan(i('4 días para tu quincena (jue 15)'));
    expect(i('Libre: ochocientos cincuenta y seis pesos')).toBeGreaterThan(barra);
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
    expect(screen.getByTestId('tarjeta-accion-0-exacto')).toHaveProp(
      'accessibilityLabel',
      'mil ciento cuarenta pesos',
    );
    expect(screen.getByTestId('tarjeta-accion-0-otra_cantidad')).toHaveProp(
      'accessibilityLabel',
      'Otra cantidad',
    );
    sinHallazgos();
    p.cerrar();
  });

  it('registro: conversación, «Entendí» de monto alto, pregunta de la cuenta, turno con "Deshacer" y R2', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    sinHallazgos();
    fireEvent.press(screen.getByTestId('boton-escribir'));
    const decir = async (frase: string) => {
      // Mandar lo escrito cierra el campo para que la respuesta se vea: se reabre para la siguiente frase.
      if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
      fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
      await act(async () => {
        fireEvent.press(screen.getByTestId('boton-enviar-registro'));
      });
    };

    await decir('renta 6000 en efectivo');
    expect(screen.getByTestId('entendi')).toBeTruthy();
    sinHallazgos();

    await decir('tacos 80 con tarjeta');
    expect(screen.getByTestId('pregunta')).toBeTruthy();
    sinHallazgos();

    await decir('coca 25 en efectivo');
    expect(screen.getByTestId('aviso-deshacer')).toBeTruthy();
    sinHallazgos();
    p.cerrar();

    // R2: el formulario completo prellenado que abre «Cambiar».
    const q = conEscenario('e4-01');
    renderConSesion(
      q.ctx,
      <PantallaR2
        prellenado={{ tipo: 'gasto', monto: 8_000, descripcion: 'tacos' }}
        alCerrar={jest.fn()}
        alGuardado={jest.fn()}
      />,
    );
    sinHallazgos();
    q.cerrar();
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
    expect(screen.getByTestId('arqueo-sobrante-me_dieron')).toHaveProp(
      'accessibilityLabel',
      'Me dieron dinero',
    );
    expect(screen.getByTestId('arqueo-sobrante-no_se')).toHaveProp(
      'accessibilityLabel',
      'No sé, solo corrígelo',
    );
    sinHallazgos();
    p.cerrar();
  });
});
