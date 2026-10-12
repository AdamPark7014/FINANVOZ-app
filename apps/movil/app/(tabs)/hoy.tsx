import { useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaHoy, paramsDeFiltro } from '../../src/pantallas/principal';

export default function Hoy() {
  const router = useRouter();
  return (
    // Un gasto compartido dictado se confirma aquí mismo (`02 §27`).
    <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
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
    </ProveedorCompartido>
  );
}
