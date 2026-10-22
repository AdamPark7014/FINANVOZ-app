import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  confirmarCompraMsi,
  listarCategorias,
  listarTarjetas,
  type OrigenDictado,
  type ResultadoTexto,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, Cifra, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { useAnunciarEnIos } from '../avisos/anunciar';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { mensajeError } from '../principal/textos';
import {
  APOYO_CONFIRMAR_MSI,
  BTN_AGREGAR_TARJETA,
  BTN_CANCELAR,
  BTN_GUARDAR_MSI,
  EJEMPLO_DESCRIPCION_MSI,
  ETIQUETA_DESCRIPCION_MSI,
  FALTA_CATEGORIA_MSI,
  FALTA_TARJETA_MSI,
  PISTA_AGREGAR_TARJETA_MSI,
  preguntaTarjetaConfirmarMsi,
  PREGUNTA_CATEGORIA_MSI,
  TEXTO_SIN_TARJETAS_MSI,
  tituloCompraMsiMeses,
  TITULO_CONFIRMAR_MSI,
} from './textos';

type ConfirmarMsi = Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;
type RegistradoMsi = Extract<ResultadoTexto, { resultado: 'registrado_msi' }>;

/** Cuentas → "Agregar tarjeta" con regreso aquí al guardar (`app/tarjetas/nueva`, `volver=1`). */
const abrirTarjetaNueva = () => router.push({ pathname: '/tarjetas/nueva', params: { volver: '1' } });

/**
 * Compra a meses que necesita confirmación (CA-M4-06): tarjeta (si falta), categoría y qué fue. Nada se guarda
 * hasta "Guardar"; al guardar, `confirmarCompraMsi` crea el plan con su calendario. Sin ninguna tarjeta
 * registrada no hay qué elegir: lo dice y ofrece "Agregar tarjeta"; al volver, la tarjeta nueva ya aparece
 * (y queda elegida si es la única).
 */
export function TarjetaConfirmarMsi({
  datos,
  origen,
  alGuardar,
  alCancelar,
  alAgregarTarjeta = abrirTarjetaNueva,
}: {
  datos: ConfirmarMsi;
  origen: OrigenDictado;
  alGuardar: (r: RegistradoMsi) => void;
  alCancelar: () => void;
  /** "Agregar tarjeta" cuando no hay ninguna; por omisión abre `/tarjetas/nueva`. */
  alAgregarTarjeta?: () => void;
}) {
  const { ctx } = useSesion();
  const { entrada, faltaTarjeta } = datos.propuesta;
  const categorias = useVista((c) => listarCategorias(c, 'gasto'));
  // Las candidatas del intérprete son las tarjetas de ese momento; si no había ninguna, se leen en vivo para que
  // la que agregues desde aquí aparezca al volver.
  const vivas = useVista((c) => listarTarjetas(c).map((t) => ({ id: t.id, nombre: t.nombre })));
  const sinCandidatas = faltaTarjeta !== null && faltaTarjeta.candidatas.length === 0;
  const candidatas = faltaTarjeta ? (sinCandidatas ? vivas : faltaTarjeta.candidatas) : [];
  const [tarjetaElegida, setTarjeta] = useState<string | null>(
    entrada.tarjetaId ??
      (faltaTarjeta?.motivo === 'aproximado' && faltaTarjeta.candidatas.length === 1
        ? (faltaTarjeta.candidatas[0]?.id ?? null)
        : null),
  );
  // Recién agregada la única tarjeta, ya queda elegida.
  const tarjeta = tarjetaElegida ?? (sinCandidatas && vivas.length === 1 ? (vivas[0]?.id ?? null) : null);
  const [categoria, setCategoria] = useState<string | null>(entrada.categoria ?? null);
  const [descripcion, setDescripcion] = useState(entrada.descripcion ?? '');
  const [error, setError] = useState<string | null>(null);
  useAnunciarEnIos(error);
  const completo = tarjeta !== null && categoria !== null;
  const falta = tarjeta === null ? FALTA_TARJETA_MSI : categoria === null ? FALTA_CATEGORIA_MSI : null;

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

  const preguntaTarjeta = faltaTarjeta ? preguntaTarjetaConfirmarMsi(faltaTarjeta) : '';

  return (
    <Tarjeta testID="confirmacion-msi">
      <Texto variante="subtitulo" testID="confirmacion-msi-titulo" accessibilityRole="header">
        {TITULO_CONFIRMAR_MSI[datos.motivo]}
      </Texto>
      <View
        accessible
        accessibilityLabel={`${tituloCompraMsiMeses(entrada.meses)}, ${formatearCentavos(entrada.monto)}`}
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
      >
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }} importantForAccessibility="no">
          {tituloCompraMsiMeses(entrada.meses)}
        </Texto>
        <Cifra centavos={entrada.monto} />
      </View>
      <Texto variante="secundario" tono="secundario">
        {APOYO_CONFIRMAR_MSI}
      </Texto>
      {faltaTarjeta && candidatas.length === 0 ? (
        <View style={{ gap: espacio.s }} testID="msi-sin-tarjetas">
          <Texto variante="cuerpo" testID="msi-sin-tarjetas-texto">
            {TEXTO_SIN_TARJETAS_MSI}
          </Texto>
          <Boton
            etiqueta={BTN_AGREGAR_TARJETA}
            variante="secundario"
            alPresionar={alAgregarTarjeta}
            pista={PISTA_AGREGAR_TARJETA_MSI}
            testID="msi-agregar-tarjeta"
          />
        </View>
      ) : faltaTarjeta ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
            {preguntaTarjeta}
          </Texto>
          <GrupoChips
            opciones={candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            valor={tarjeta}
            alCambiar={setTarjeta}
            prefijoTestID="msi-tarjeta"
            etiqueta={preguntaTarjeta}
          />
        </View>
      ) : null}
      <View style={{ gap: espacio.xs }}>
        <Texto variante="secundario" tono="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
          {PREGUNTA_CATEGORIA_MSI}
        </Texto>
        <GrupoChips
          opciones={categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }))}
          valor={categoria}
          alCambiar={setCategoria}
          prefijoTestID="msi-categoria"
          etiqueta={PREGUNTA_CATEGORIA_MSI}
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
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={BTN_GUARDAR_MSI}
        alPresionar={guardar}
        deshabilitado={!completo}
        pista={falta ?? undefined}
        testID="boton-guardar-msi"
      />
      <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alCancelar} testID="boton-cancelar-msi" />
    </Tarjeta>
  );
}
