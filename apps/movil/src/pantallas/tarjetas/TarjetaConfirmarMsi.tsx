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
import { mensajeError } from '../principal/textos';
import {
  APOYO_CONFIRMAR_MSI,
  BTN_CANCELAR,
  BTN_GUARDAR_MSI,
  EJEMPLO_DESCRIPCION_MSI,
  ETIQUETA_DESCRIPCION_MSI,
  preguntaTarjetaConfirmarMsi,
  PREGUNTA_CATEGORIA_MSI,
  tituloCompraMsiMeses,
  TITULO_CONFIRMAR_MSI,
} from './textos';

type ConfirmarMsi = Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;
type RegistradoMsi = Extract<ResultadoTexto, { resultado: 'registrado_msi' }>;

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
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Tarjeta testID="confirmacion-msi">
      <Texto variante="subtitulo">{TITULO_CONFIRMAR_MSI[datos.motivo]}</Texto>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
          {tituloCompraMsiMeses(entrada.meses)}
        </Texto>
        <Cifra centavos={entrada.monto} />
      </View>
      <Texto variante="secundario" tono="secundario">
        {APOYO_CONFIRMAR_MSI}
      </Texto>
      {faltaTarjeta ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario">
            {preguntaTarjetaConfirmarMsi(faltaTarjeta)}
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
        etiqueta={ETIQUETA_DESCRIPCION_MSI}
        ejemplo={EJEMPLO_DESCRIPCION_MSI}
        valor={descripcion}
        alCambiar={setDescripcion}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={BTN_GUARDAR_MSI}
        alPresionar={guardar}
        deshabilitado={!completo}
        testID="boton-guardar-msi"
      />
      <Boton
        etiqueta={BTN_CANCELAR}
        variante="texto"
        alPresionar={alCancelar}
        testID="boton-cancelar-msi"
      />
    </Tarjeta>
  );
}
