import { useRouter } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTandas } from '../../src/pantallas/tandas';

/** Cuentas → Tandas (`02 §18`). */
export default function TandasRuta() {
  const router = useRouter();
  return (
    <ProveedorAvisos>
      <PantallaTandas
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/cuentas'))}
        alAbrirTanda={(id) => router.push({ pathname: '/tandas/[id]', params: { id } })}
      />
    </ProveedorAvisos>
  );
}
