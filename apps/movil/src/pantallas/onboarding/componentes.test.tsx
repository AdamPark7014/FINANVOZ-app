import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ANALITICA_APAGADA } from '../../analitica/cliente';
import { ProveedorAnalitica } from '../../sesion/ProveedorAnalitica';
import { Casilla, Chips, PasoOnboarding } from './componentes';
import {
  anuncioCambioPasoOnboarding,
  AYUDA_BIENVENIDA,
  PISTA_CASILLA_ONB,
  PISTA_CHIP_ONB_ELEGIR,
  PISTA_CHIP_ONB_SELECCIONADA,
  PISTA_PROGRESO_ONB,
  TITULO_BIENVENIDA,
} from './textos';
import { crearSesionPrueba } from './__pruebas__/sesion';

describe('componentes onboarding · TalkBack', () => {
  const s = crearSesionPrueba();

  afterAll(() => s.cerrar());

  function envolver(ui: ReactElement) {
    return (
      <s.Envoltura>
        <ProveedorAnalitica analitica={ANALITICA_APAGADA}>{ui}</ProveedorAnalitica>
      </s.Envoltura>
    );
  }

  it('PasoOnboarding anuncia progreso y título con lector activo', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});

    render(
      envolver(
        <PasoOnboarding paso={1} titulo={TITULO_BIENVENIDA} ayuda={AYUDA_BIENVENIDA} testID="onb-test">
          <></>
        </PasoOnboarding>,
      ),
    );

    await waitFor(() => {
      expect(anunciar).toHaveBeenCalledWith(anuncioCambioPasoOnboarding(1, TITULO_BIENVENIDA));
    });
    expect(screen.getByTestId('onb-progreso')).toHaveProp('accessibilityHint', PISTA_PROGRESO_ONB);
    expect(screen.getByTestId('onb-titulo-paso')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('onb-titulo-paso')).toHaveProp('accessibilityLabel', TITULO_BIENVENIDA);
  });

  it('Chips traen pista al elegir y al estar seleccionados', () => {
    render(
      envolver(
        <Chips
          testID="chip"
          etiqueta="Frecuencia"
          opciones={[
            { valor: 'a', etiqueta: 'Una' },
            { valor: 'b', etiqueta: 'Dos' },
          ]}
          valor="a"
          alCambiar={() => {}}
        />,
      ),
    );
    expect(screen.getByTestId('chip-a')).toHaveProp('accessibilityHint', PISTA_CHIP_ONB_SELECCIONADA);
    expect(screen.getByTestId('chip-b')).toHaveProp('accessibilityHint', PISTA_CHIP_ONB_ELEGIR);
  });

  it('Casilla trae pista para marcar o desmarcar', () => {
    render(envolver(<Casilla testID="casilla" etiqueta="Acepto" valor={false} alCambiar={() => {}} />));
    expect(screen.getByTestId('casilla')).toHaveProp('accessibilityHint', PISTA_CASILLA_ONB);
  });
});
