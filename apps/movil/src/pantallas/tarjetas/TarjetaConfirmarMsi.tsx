import { useState } from 'react';
import { View } from 'react-native';
import {
  confirmarCompraMsi,
  listarCategorias,
  type OrigenDictado,
  type ResultadoTexto,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from '../principal/Chip';
import { MENSAJE_ERROR_GENERAL } from '../principal/textos';

type ConfirmarMsi = Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;
type RegistradoMsi = Extract<ResultadoTexto, { resultado: 'registrado_msi' }>;

const TITULO: Record<ConfirmarMsi['motivo'], string> = {
  monto_alto: 'Es un monto alto. Revísalo antes de guardar.',
  cuenta: '¿Con qué tarjeta fue?',
  aproximado: 'Confírmame la tarjeta.',
};

/**
 * Compra a meses que necesita confirmación (CA-M4-06): tarjeta (si falta), categoría y qué fue. Nada se guarda
 * hasta "Guardar"; al guardar, `confirmarCompraMsi` crea el plan con su calendario.
 */
export function TarjetaConfirmarMsi({
  datos,
  origen,
  alGuardar,
  alCancelar,
}: {
  datos: ConfirmarMsi;
  origen: OrigenDictado;
  alGuardar: (r: RegistradoMsi) => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const { entrada, faltaTarjeta } = datos.propuesta;
  const categorias = useVista((c) => listarCategorias(c, 'gasto'));
  const [tarjeta, setTarjeta] = useState<string | null>(
    entrada.tarjetaId ??
      (faltaTarjeta?.motivo === 'aproximado' && faltaTarjeta.candidatas.length === 1
        ? (faltaTarjeta.candidatas[0]?.id ?? null)
        : null),
  );
  const [categoria, setCategoria] = useState<string | null>(entrada.categoria ?? null);
  const [descripcion, setDescripcion] = useState(entrada.descripcion ?? '');
  const [error, setError] = useState<string | null>(null);
  const completo = tarjeta !== null && categoria !== null;

  const guardar = () => {
    if (!tarjeta || !categoria) return;
    const alias = faltaTarjeta && faltaTarjeta.motivo !== 'ambigua' ? faltaTarjeta.alias : null;
    try {
      alGuardar(
        confirmarCompraMsi(
          ctx,
          {
            ...entrada,
            tarjetaId: tarjeta,
            categoria,
            ...(descripcion.trim() !== '' ? { descripcion: descripcion.trim() } : {}),
          },
          origen,
          alias ? { aprender: { alias } } : {},
        ),
      );
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };

  return (
    <Tarjeta testID="confirmacion-msi">
      <Texto variante="subtitulo">{TITULO[datos.motivo]}</Texto>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
          {`Compra a ${entrada.meses} meses sin intereses`}
        </Texto>
        <Cifra centavos={entrada.monto} />
      </View>
      <Texto variante="secundario" tono="secundario">
        La compra cuenta completa como gasto hoy; cada mes aparto solo la mensualidad.
      </Texto>
      {faltaTarjeta ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario">
            {faltaTarjeta.motivo === 'no_encontrada' && faltaTarjeta.alias
              ? `No tengo una tarjeta «${faltaTarjeta.alias}». ¿Con cuál fue?`
              : '¿Con qué tarjeta fue?'}
          </Texto>
          <GrupoChips
            opciones={faltaTarjeta.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            valor={tarjeta}
            alCambiar={setTarjeta}
            prefijoTestID="msi-tarjeta"
          />
        </View>
      ) : null}
      <View style={{ gap: espacio.xs }}>
        <Texto variante="secundario" tono="secundario">
          ¿En qué categoría va?
        </Texto>
        <GrupoChips
          opciones={categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }))}
          valor={categoria}
          alCambiar={setCategoria}
          prefijoTestID="msi-categoria"
        />
      </View>
      <CampoTexto
        testID="msi-descripcion"
        etiqueta="¿Qué compraste? (opcional)"
        ejemplo="tele"
        valor={descripcion}
        alCambiar={setDescripcion}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar" alPresionar={guardar} deshabilitado={!completo} testID="boton-guardar-msi" />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID="boton-cancelar-msi" />
    </Tarjeta>
  );
}
