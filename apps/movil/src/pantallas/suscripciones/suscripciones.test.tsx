import { fireEvent, screen } from '@testing-library/react-native';
import { listarCuentas, obtenerHoy, sincronizarPlan, type Contexto } from '../../servicios';
import { registrarGastosE14, type GastoVectorE14 } from '../../servicios/__pruebas__/suscripciones';
import { auditar } from '../__pruebas__/accesibilidad';
import { conEscenario, vector } from '../principal/__pruebas__/base';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaCuentas } from '../principal/PantallaCuentas';
import { PantallaSuscripciones } from './PantallaSuscripciones';
import {
  BTN_SUSCRIPCIONES_CUENTAS,
  mensajeAccionSuscripcion,
  mensajeNombreGuardado,
  PISTA_AYUDA,
  PISTA_VOLVER,
  etiquetaAccesibleAyudaSuscripciones,
  etiquetaAccesibleHoyApartaSuscripcion,
  etiquetaAccesibleProximoSuscripcion,
  etiquetaAccesibleResumenSuscripciones,
  etiquetaInactivasSuscripciones,
  etiquetaVacioSuscripciones,
  TEXTO_SUSCRIPCIONES_VACIO,
} from './textos';

interface VectorE14 {
  hoy: string;
  catalogo: string[];
  gastos: GastoVectorE14[];
}

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

/** Semilla e4-01 (hoy dom 11 oct) con un libro equivalente a E14-01 y su catálogo (vacío). */
function preparar(): { ctx: Contexto } {
  const v = vector<VectorE14>('E14-01');
  const p = conEscenario('e4-01');
  sincronizarPlan(p.ctx, { plus: { vigenteHasta: null, enPrueba: false, renovara: true } });
  const efectivo = listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Cartera')?.id as string;
  registrarGastosE14(p.ctx, v.gastos, efectivo);
  return { ctx: { ...p.ctx, catalogoSuscripciones: v.catalogo } };
}

describe('textos de suscripciones', () => {
  it('estado vacío sin cifras y ayuda en plural', () => {
    expect(TEXTO_SUSCRIPCIONES_VACIO).not.toMatch(/\$/);
    expect(PISTA_AYUDA).toContain('Conviértelas');
  });

  it('mensajes de acción y renombrar', () => {
    expect(mensajeAccionSuscripcion('no_es', 'Dominio web')).toBe(
      'Listo: Dominio web ya no aparece como suscripción.',
    );
    expect(mensajeNombreGuardado('Dominio web')).toBe('Listo: la llamo Dominio web.');
  });
});

describe('Suscripciones (02 §20)', () => {
  it('Volver tiene pista TalkBack', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    expect(screen.getByTestId('suscripciones-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('suscripciones-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
  });

  it('TalkBack: resumen y montos en palabras; auditoría estricta sin hallazgos', () => {
    const { ctx } = preparar();
    renderConSesion(ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    expect(screen.getByTestId('suscripciones-ayuda')).toHaveProp(
      'accessibilityLabel',
      etiquetaAccesibleAyudaSuscripciones(),
    );
    expect(screen.getByTestId('suscripciones-resumen')).toHaveProp(
      'accessibilityLabel',
      etiquetaAccesibleResumenSuscripciones(
        'Pagas unos $1,626 al mes en 5 suscripciones ($19,514 al año)',
      ),
    );
    expect(screen.getByTestId('suscripcion-netflix-monto').props.accessibilityLabel).toMatch(/pesos/);
    expect(screen.getByTestId('suscripcion-netflix-nombre')).toHaveProp('accessibilityRole', 'header');
    expect(auditar(screen.toJSON() as never, { etiquetaExplicita: true })).toEqual([]);
  });

  it('CA-M10-01 · muestra las 5 activas con monto y fecha, el resumen, "antes $115" y Disney Plus aparte', () => {
    const { ctx } = preparar();
    renderConSesion(ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    expect(textoDe('suscripciones-ayuda')).toBe(PISTA_AYUDA);
    expect(textoDe('suscripciones-resumen')).toBe(
      'Pagas unos $1,626 al mes en 5 suscripciones ($19,514 al año)',
    );
    const filas: [string, string, string][] = [
      ['estudio-yoga', '$150 cada semana', 'próximo vie 16 oct'],
      ['smart-fit', '$599 al mes', 'próximo 1 nov'],
      ['netflix', '$219 al mes', 'próximo 14 oct'],
      ['spotify', '$129 al mes (antes $115)', 'próximo 5 nov'],
      ['dominio-web', '$350 al año', 'próximo 8 oct 2027'],
    ];
    for (const [id, monto, proximo] of filas) {
      expect(textoDe(`suscripcion-${id}-monto`)).toBe(monto);
      expect(textoDe(`suscripcion-${id}-proximo`)).toBe(proximo);
      expect(screen.getByTestId(`suscripcion-${id}-proximo`)).toHaveProp(
        'accessibilityLabel',
        etiquetaAccesibleProximoSuscripcion(proximo),
      );
    }
    expect(screen.queryByTestId('suscripcion-disney-plus')).toBeNull();
    const inactivas = 'Ya no se cobran: Disney Plus (último cargo 20 jul)';
    expect(textoDe('suscripciones-inactivas')).toBe(inactivas);
    expect(screen.getByTestId('suscripciones-inactivas')).toHaveProp(
      'accessibilityLabel',
      etiquetaInactivasSuscripciones(inactivas),
    );
  });

  it('Editar nombre: guarda "Dominio web" en la fila', () => {
    const { ctx } = preparar();
    renderConSesion(ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('suscripcion-dominio-web-editar-nombre'));
    fireEvent.changeText(screen.getByTestId('suscripcion-dominio-web-nombre'), 'Dominio web');
    fireEvent.press(screen.getByTestId('suscripcion-dominio-web-guardar-nombre'));
    expect(textoDe('suscripciones-mensaje')).toBe(mensajeNombreGuardado('Dominio web'));
    expect(screen.getByText('Dominio web')).toBeTruthy();
  });

  it('Convertir en compromiso: Hoy aparta Netflix y la fila lo dice', () => {
    const { ctx } = preparar();
    const antes = obtenerHoy(ctx).reservado;
    renderConSesion(ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('suscripcion-netflix-compromiso'));
    expect(screen.getByTestId('suscripciones-mensaje')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('suscripciones-mensaje')).toHaveProp('importantForAccessibility', 'yes');
    expect(textoDe('suscripciones-mensaje')).toBe(mensajeAccionSuscripcion('compromiso', 'Netflix'));
    expect(screen.getByTestId('suscripcion-netflix-apartada')).toHaveProp(
      'accessibilityLabel',
      etiquetaAccesibleHoyApartaSuscripcion('Netflix'),
    );
    expect(screen.queryByTestId('suscripcion-netflix-compromiso')).toBeNull();
    expect(obtenerHoy(ctx).reservado - antes).toBe(21_900);
  });

  it('"Ya la cancelé" en un compromiso la oculta y deja de apartarla', () => {
    const { ctx } = preparar();
    renderConSesion(ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('suscripcion-netflix-compromiso'));
    const reservado = obtenerHoy(ctx).reservado;
    fireEvent.press(screen.getByTestId('suscripcion-netflix-cancelada'));
    expect(screen.queryByTestId('suscripcion-netflix')).toBeNull();
    expect(obtenerHoy(ctx).reservado).toBeLessThan(reservado);
  });

  it('Ya la cancelé y No es suscripción la quitan de la lista y del resumen', () => {
    const { ctx } = preparar();
    renderConSesion(ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('suscripcion-smart-fit-cancelada'));
    expect(screen.queryByTestId('suscripcion-smart-fit')).toBeNull();
    expect(textoDe('suscripciones-mensaje')).toBe(mensajeAccionSuscripcion('cancelada', 'Smart Fit'));
    fireEvent.press(screen.getByTestId('suscripcion-dominio-web-no-es'));
    expect(screen.queryByTestId('suscripcion-dominio-web')).toBeNull();
    expect(textoDe('suscripciones-resumen')).toBe(
      'Pagas unos $998 al mes en 3 suscripciones ($11,976 al año)',
    );
  });

  it('sin cargos que se repitan lo explica sin cifras', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaSuscripciones alVolver={jest.fn()} />);
    expect(screen.getByTestId('suscripciones-vacio')).toHaveTextContent(TEXTO_SUSCRIPCIONES_VACIO);
    expect(screen.getByTestId('suscripciones-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioSuscripciones(),
    );
    expect(auditar(screen.toJSON() as never, { etiquetaExplicita: true })).toEqual([]);
    expect(screen.queryByTestId('suscripciones-inactivas')).toBeNull();
  });

  it('Cuentas abre Suscripciones', () => {
    const p = conEscenario('e4-01');
    const alAbrir = jest.fn();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirSuscripciones={alAbrir} />);
    expect(screen.getByTestId('seccion-suscripciones-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('boton-suscripciones').props.accessibilityLabel).toBe(
      BTN_SUSCRIPCIONES_CUENTAS,
    );
    fireEvent.press(screen.getByTestId('boton-suscripciones'));
    expect(alAbrir).toHaveBeenCalled();
  });
});
