import { useLocalSearchParams, useRouter } from 'expo-router';
import { detalleDeParams, filtroDeParams, PantallaMovimientos } from '../../src/pantallas/principal';

export default function Movimientos() {
  const router = useRouter();
  // "Ver movimientos" de una consulta: fechas, categorías e id de cuenta en la ruta (sin montos ni textos).
  const params = useLocalSearchParams<Record<string, string>>();
  const filtro = filtroDeParams(params);
  const detalle = detalleDeParams(params);
  return (
    <PantallaMovimientos
      filtro={filtro}
      detalleInicial={detalle}
      alQuitarFiltro={() => {
        router.setParams({
          desde: undefined,
          hasta: undefined,
          categorias: undefined,
          cuenta: undefined,
          gastos: undefined,
          detalle: undefined,
        });
      }}
      alRegistrar={() => router.navigate('/registrar')}
      alRevisar={(id) => router.navigate({ pathname: '/registrar', params: { frase: id } })}
      alAbrirPersona={(id) => router.push({ pathname: '/persona/[id]', params: { id } })}
    />
  );
}