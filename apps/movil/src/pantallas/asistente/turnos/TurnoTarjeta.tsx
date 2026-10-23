import type { TurnoTarjeta as DatosTurnoTarjeta } from '../../../asistente/conversacion';
import type { ResultadoTexto } from '../../../servicios';
import { Tarjeta, Texto } from '../../../ui';
import { TarjetaConfirmarCompartido } from '../../compartido/TarjetaConfirmarCompartido';
import { MENSAJE_COMPARTIDO_GUARDADO } from '../../compartido/textos';
import { FormularioCuentaDividida } from '../../personas/FormularioCuentaDividida';
import { TITULO_CONFIRMAR_DIVISION } from '../../personas/textos';
import { TarjetaConfirmarTanda } from '../../principal/TarjetaConfirmarTanda';
import { TarjetaDuplicados, TarjetaElegir } from '../../principal/TarjetasInterpretacion';
import { FormularioTanda } from '../../tandas/FormularioTanda';
import { FormularioTarjetaNueva } from '../../tarjetas/FormularioTarjetaNueva';
import { TarjetaConfirmarMsi } from '../../tarjetas/TarjetaConfirmarMsi';

export const MENSAJE_TARJETA_AGREGADA = 'Listo: agregué tu tarjeta.';
export const MENSAJE_TANDA_GUARDADA = 'Listo: guardé tu tanda. Aparto cada aportación el día que toca.';

/**
 * Lo que todavía se resuelve con su tarjeta de siempre (elegir, duplicados, tanda, compartido y los formularios
 * largos mientras su flujo conversacional no exista, §6). Al terminar, el resultado vuelve a la conversación.
 */
export function TurnoTarjeta({
  turno,
  alResultado,
  alListo,
  alCancelar,
}: {
  turno: DatosTurnoTarjeta;
  /** Lo guardado como resultado del intérprete: se vuelve turno «Registré…». */
  alResultado: (r: ResultadoTexto) => void;
  /** Guardado sin resultado (compartido, tarjeta nueva, tanda): un turno con el mensaje. */
  alListo: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const { datos, origen } = turno;
  switch (datos.resultado) {
    case 'elegir':
      return <TarjetaElegir datos={datos} origen={origen} alTerminar={alResultado} alCancelar={alCancelar} />;
    case 'duplicados':
      return (
        <TarjetaDuplicados datos={datos} origen={origen} alTerminar={alResultado} alCerrar={alCancelar} />
      );
    case 'confirmar_msi':
      return (
        <TarjetaConfirmarMsi datos={datos} origen={origen} alGuardar={alResultado} alCancelar={alCancelar} />
      );
    case 'confirmar_division':
      return (
        <Tarjeta testID="confirmacion-division">
          <Texto variante="subtitulo">{TITULO_CONFIRMAR_DIVISION}</Texto>
          <FormularioCuentaDividida
            prellenado={datos.propuesta}
            origen={origen}
            alGuardar={alResultado}
            alCancelar={alCancelar}
          />
        </Tarjeta>
      );
    case 'confirmar_compartido':
      return (
        <TarjetaConfirmarCompartido
          propuesta={datos.propuesta}
          alGuardar={() => alListo(MENSAJE_COMPARTIDO_GUARDADO)}
          alCancelar={alCancelar}
        />
      );
    case 'confirmar_tanda':
      return (
        <TarjetaConfirmarTanda
          datos={datos}
          origen={origen}
          alGuardar={alResultado}
          alCancelar={alCancelar}
        />
      );
    case 'tarjeta_por_agregar':
      return (
        <Tarjeta testID="tarjeta-por-agregar">
          <Texto variante="subtitulo">
            {datos.prellenado.alias
              ? `No tengo una tarjeta «${datos.prellenado.alias}». ¿La agrego?`
              : '¿Qué tarjeta es? Agrégala con sus datos.'}
          </Texto>
          <Texto variante="secundario" tono="secundario">
            Ya puse lo que me dijiste. Falta cuánto debes hoy: sin eso no la agrego.
          </Texto>
          <FormularioTarjetaNueva
            prellenado={datos.prellenado}
            alGuardar={() => alListo(MENSAJE_TARJETA_AGREGADA)}
            alCancelar={alCancelar}
          />
        </Tarjeta>
      );
    case 'tanda_por_crear':
      return (
        <Tarjeta testID="tanda-por-crear">
          <Texto variante="subtitulo">Revisa tu tanda</Texto>
          <Texto variante="secundario" tono="secundario">
            Ya puse lo que me dijiste. Corrige la primera fecha si no es la que te dieron.
          </Texto>
          <FormularioTanda
            prellenado={datos.propuesta}
            alGuardar={() => alListo(MENSAJE_TANDA_GUARDADA)}
            alCancelar={alCancelar}
          />
        </Tarjeta>
      );
  }
}
