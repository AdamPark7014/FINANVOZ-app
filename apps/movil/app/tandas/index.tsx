import { useRouter } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTandas } from '../../src/pantallas/tandas';
import { BarraNativa } from '../../src/ui/navegacion';

/** Cuentas → Tandas (`02 §18`). */
export default function TandasRuta() {
  const router = useRouter();
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <ProveedorAvisos>
        <PantallaTandas alAbrirTanda={(id) => router.push({ pathname: '/tandas/[id]', params: { id } })} />
      </ProveedorAvisos>
    </>
  );
}
