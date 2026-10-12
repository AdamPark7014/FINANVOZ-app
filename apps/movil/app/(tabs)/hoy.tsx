import { useRouter } from 'expo-router';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaHoy } from '../../src/pantallas/principal';

export default function Hoy() {
  const router = useRouter();
  return (
    <PantallaHoy
      navegacion={{
        alVerMovimientos: () => router.navigate('/movimientos'),
        // El ingreso se configura en Ajustes (02-UX §12).
        alConfigurarIngreso: () => router.push('/ajustes'),
        alAbrirFormulario: () => router.navigate('/registrar'),
        alVerCuentas: () => router.navigate('/cuentas'),
        alAbrirArqueo: (efectivoReal) =>
          abrirArqueo(router, efectivoReal !== undefined ? { efectivoReal } : {}),
        alAbrirMeAlcanza: (consulta) => abrirMeAlcanza(router, consulta),
      }}
    />
  );
}
