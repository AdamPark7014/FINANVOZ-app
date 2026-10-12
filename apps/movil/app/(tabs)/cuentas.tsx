import { useRouter } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaCuentas } from '../../src/pantallas/principal';

export default function Cuentas() {
  const router = useRouter();
  return (
    <PantallaCuentas
      alAbrirAjustes={() => router.push('/ajustes')}
      alAbrirTarjeta={(id) => router.push({ pathname: '/tarjetas/[id]', params: { id } })}
      alAgregarTarjeta={() => router.push('/tarjetas/nueva')}
      alAbrirPersona={(id) => router.push({ pathname: '/persona/[id]', params: { id } })}
      alContarEfectivo={(cuentaId) => abrirArqueo(router, { cuentaId })}
      alAbrirTandas={() => router.push('/tandas')}
    />
  );
}
