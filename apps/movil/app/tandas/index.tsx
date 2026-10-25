import { Stack, useRouter } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTandas } from '../../src/pantallas/tandas';
import { TITULO_TANDAS } from '../../src/pantallas/tandas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Cuentas → Tandas (`02 §18`). */
export default function TandasRuta() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_TANDAS)} />
      <ProveedorAvisos>
        <PantallaTandas
          alAbrirTanda={(id) => router.push({ pathname: '/tandas/[id]', params: { id } })}
        />
      </ProveedorAvisos>
    </>
  );
}
