import type { ConsultaMeAlcanza, FiltroMovimientos } from '../../servicios';
import type { MotorDictado } from '../../voz';
import { PanelConversacion } from '../asistente/PantallaAsistente';

/**
 * El panel de registrar de antes ya es la conversación del asistente (Ola 7): esta envoltura queda para lo que
 * todavía dicta dentro de otra pantalla (pruebas de compartido y de micrófonos). Solo pinta los turnos de la sesión.
 */
export function PanelRegistrar({
  alVerMovimientos,
  alVerMovimiento,
  alMasOpciones,
  alArqueo,
  alMeAlcanza,
  motor,
  abiertoAlInicio = false,
  fraseRevision,
  dictarAlAbrir = false,
}: {
  alVerMovimientos?: (filtro: FiltroMovimientos) => void;
  alVerMovimiento?: (transaccionId: string) => void;
  alMasOpciones?: () => void;
  alArqueo?: (efectivoReal: number) => void;
  alMeAlcanza?: (consulta: ConsultaMeAlcanza) => void;
  motor?: MotorDictado;
  abiertoAlInicio?: boolean;
  fraseRevision?: string;
  /** Sin efecto: la barra de voz siempre va al pie. */
  fijo?: boolean;
  dictarAlAbrir?: boolean;
}) {
  return (
    <PanelConversacion
      navegacion={{
        alVerMovimientos: (filtro) => alVerMovimientos?.(filtro ?? {}),
        ...(alVerMovimiento ? { alVerMovimiento } : {}),
        alConfigurarIngreso: () => {},
        alAbrirFormulario: alMasOpciones ?? (() => {}),
        ...(alArqueo ? { alAbrirArqueo: (efectivo?: number) => alArqueo(efectivo ?? 0) } : {}),
        ...(alMeAlcanza
          ? {
              alAbrirMeAlcanza: (consulta?: ConsultaMeAlcanza) =>
                consulta ? alMeAlcanza(consulta) : undefined,
            }
          : {}),
      }}
      {...(motor ? { motor } : {})}
      abiertoAlInicio={abiertoAlInicio}
      {...(fraseRevision ? { fraseRevision } : {})}
      dictarAlAbrir={dictarAlAbrir}
    />
  );
}
