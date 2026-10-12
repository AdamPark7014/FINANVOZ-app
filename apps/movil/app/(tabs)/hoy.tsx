import { useRouter } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaHoy, paramsDeFiltro } from '../../src/pantallas/principal';

export default function Hoy() {
  const router = useRouter();
  return (
    <PantallaHoy
      navegacion={{
        alVerMovimientos: (filtro) =>
          router.navigate({ pathname: '/movimientos', params: filtro ? paramsDeFiltro(filtro) : {} }),
        // El ingreso se configura en Ajustes (02-UX §12).
        alConfigurarIngreso: () => router.push('/ajustes'),
        alAbrirFormulario: () => router.navigate('/registrar'),
        alAbrirArqueo: (efectivoReal) =>
          abrirArqueo(router, efectivoReal !== undefined ? { efectivoReal } : {}),
        alAbrirMeAlcanza: (consulta) => abrirMeAlcanza(router, consulta),
      }}
    />
  );
}
