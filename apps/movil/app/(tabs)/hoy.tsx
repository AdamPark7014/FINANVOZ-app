import { useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { useConfirmacionAlVolver } from '../../src/pantallas/ajustes/confirmacion';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaHoy, paramsDeFiltro, useMostrarAviso } from '../../src/pantallas/principal';

export default function Hoy() {
  const router = useRouter();
  const mostrarAviso = useMostrarAviso();
  // "Listo: guardé tu ingreso…" al regresar de Ajustes › Ingreso.
  useConfirmacionAlVolver((mensaje) => mostrarAviso({ mensaje }));
  return (
    // Un gasto compartido dictado se confirma aquí mismo (`02 §27`).
    <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
      <PantallaHoy
        navegacion={{
          alVerMovimientos: (filtro) =>
            router.navigate({ pathname: '/movimientos', params: filtro ? paramsDeFiltro(filtro) : {} }),
          // Directo a Ajustes › Ingreso (02-UX §12); al guardar regresa aquí.
          alConfigurarIngreso: () => router.push('/ajustes/ingreso'),
          alAbrirFormulario: () => router.navigate('/registrar'),
          alAbrirArqueo: (efectivoReal) =>
            abrirArqueo(router, efectivoReal !== undefined ? { efectivoReal } : {}),
          alAbrirMeAlcanza: (consulta) => abrirMeAlcanza(router, consulta),
        }}
      />
    </ProveedorCompartido>
  );
}
