/**
 * Dependencias de gastos compartidos en el teléfono (M16): XChaCha20-Poly1305 de `@noble/ciphers` con bytes de
 * expo-crypto, la llave de cada grupo en expo-secure-store y el cliente de `/compartido/*` (nulo sin nube).
 */
import { crearCriptoNoble } from '@cartera/sincronizacion/noble';
import { aleatorioExpo, almacenExpo } from '../db/expo';
import { crearClienteCompartidoExpo } from '../nube/expo';
import type { DependenciasCompartido } from '../servicios';

let deps: DependenciasCompartido | null = null;

export function dependenciasCompartidoExpo(): DependenciasCompartido {
  deps ??= {
    cripto: crearCriptoNoble(aleatorioExpo),
    almacen: almacenExpo,
    cliente: crearClienteCompartidoExpo(),
  };
  return deps;
}
