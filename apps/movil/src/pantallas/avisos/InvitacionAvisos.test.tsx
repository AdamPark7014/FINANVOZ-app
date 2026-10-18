import { render, screen, waitFor } from '@testing-library/react-native';
import { listarTarjetas } from '../../servicios';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { conEscenario } from '../principal/__pruebas__/base';
import { InvitacionAvisos, reiniciarInvitacionAvisos } from './InvitacionAvisos';
import { notificacionesEnMemoria, ProveedorNotificaciones } from './notificaciones';
import {
  etiquetaAccesibleInvitacionAvisos,
  PISTA_INVITACION_AVISOS_NO,
  PISTA_INVITACION_AVISOS_SI,
  TITULO_INVITACION_AVISOS,
} from './textos';

function montar(ctx: ReturnType<typeof conEscenario>['ctx']) {
  const n = notificacionesEnMemoria('sin_preguntar');
  render(
    <ProveedorNotificaciones notificaciones={n}>
      <ProveedorSesion ctx={ctx}>
        <InvitacionAvisos />
      </ProveedorSesion>
    </ProveedorNotificaciones>,
  );
  return n;
}

beforeEach(() => reiniciarInvitacionAvisos());

describe('InvitacionAvisos · TalkBack', () => {
  it('con tarjeta y sin permiso muestra encabezado oculto, aviso y pistas en botones', async () => {
    const p = conEscenario('e5-10');
    expect(listarTarjetas(p.ctx).length).toBeGreaterThan(0);
    montar(p.ctx);

    await waitFor(() => expect(screen.getByTestId('invitacion-avisos')).toBeTruthy());
    expect(screen.getByTestId('invitacion-avisos-titulo')).toHaveProp('importantForAccessibility', 'no');
    expect(screen.getByTestId('invitacion-avisos-cuerpo')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByTestId('invitacion-avisos-cuerpo')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('invitacion-avisos-cuerpo').props.accessibilityLabel).toBe(
      etiquetaAccesibleInvitacionAvisos(),
    );
    expect(screen.getByTestId('invitacion-avisos-si')).toHaveProp('accessibilityHint', PISTA_INVITACION_AVISOS_SI);
    expect(screen.getByTestId('invitacion-avisos-no')).toHaveProp('accessibilityHint', PISTA_INVITACION_AVISOS_NO);
    expect(etiquetaAccesibleInvitacionAvisos()).toContain(TITULO_INVITACION_AVISOS);
  });
});
