import { interpretarMonto } from '@cartera/nlu';
import type { ReactNode } from 'react';
import { ContextoDictadoCampos, type DictadoCampos } from '../ui';
import { BotonDictarCampo } from './BotonDictarCampo';

/** Fijo: el botón y el intérprete no cambian en la vida de la app (sin re-render de los campos). */
const DICTADO_CAMPOS: DictadoCampos = { BotonDictar: BotonDictarCampo, interpretarMonto };

/** Micrófono en todos los campos de monto (`CampoMonto`), del onboarding en adelante. */
export function ProveedorDictadoCampos({ children }: { children: ReactNode }) {
  return <ContextoDictadoCampos.Provider value={DICTADO_CAMPOS}>{children}</ContextoDictadoCampos.Provider>;
}
