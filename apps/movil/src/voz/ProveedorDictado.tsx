import { useMemo, useRef, type ReactNode } from 'react';
import {
  ContextoDictadoCampos,
  type DictadoCampos,
  type LectorMontoDictado,
} from '../ui/componentes/dictado-campo';
import { BotonDictarCampo } from './BotonDictarCampo';
import { ContextoDictado, type Dictador } from './dictador';
import type { MotorDictado } from './motor';

export { useDictador, type Dictador } from './dictador';

/**
 * Lee la cifra dicha en un campo de dinero ("ocho mil quinientos", "como 500"): centavos enteros y si la
 * persona la dio como aproximada; `null` si no hay una cifra clara. La inyecta la raíz (servicios, con el
 * intérprete del nivel 0), así `ui/` y `voz/` no dependen de `@cartera/nlu`.
 */
export type LectorMonto = LectorMontoDictado;

/**
 * Voz de toda la app con un solo reconocedor: un micrófono a la vez (el que empieza calla al anterior y descarta
 * sus restos, `useMicrofono`) y el dictado de los campos de `ui/` (`ContextoDictadoCampos`): el micrófono de cada
 * `CampoMonto` y de «O dímelo» (`BotonDictarCampo`) con el intérprete de cifras que pasa la raíz.
 */
export function ProveedorDictado({
  motor,
  leerMonto,
  children,
}: {
  motor: MotorDictado;
  leerMonto: LectorMonto;
  children: ReactNode;
}) {
  const actual = useRef<{ id: string; soltar: () => void } | null>(null);
  const dictador = useMemo<Dictador>(
    () => ({
      motor,
      tomar(id, soltar) {
        const previo = actual.current;
        actual.current = { id, soltar };
        if (previo === null || previo.id === id) return false;
        previo.soltar();
        return true;
      },
      liberar(id) {
        if (actual.current?.id === id) actual.current = null;
      },
    }),
    [motor],
  );
  const campos = useMemo<DictadoCampos>(
    () => ({ BotonDictar: BotonDictarCampo, interpretarMonto: leerMonto }),
    [leerMonto],
  );
  return (
    <ContextoDictado.Provider value={dictador}>
      <ContextoDictadoCampos.Provider value={campos}>{children}</ContextoDictadoCampos.Provider>
    </ContextoDictado.Provider>
  );
}
