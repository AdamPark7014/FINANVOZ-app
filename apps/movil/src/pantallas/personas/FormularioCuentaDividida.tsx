import { useState } from 'react';
import { View } from 'react-native';
import type { Centavos } from '@cartera/core';
import {
  confirmarCuentaDividida,
  crearPersona,
  listarCategorias,
  listarCuentas,
  listarPersonas,
  MAX_PARTES,
  repartoCuentaDividida,
  type OrigenDictado,
  type PropuestaCuentaDividida,
  type ResultadoTexto,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Cifra, espacio, formatearCentavos, Texto } from '../../ui';
import { Chip, GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { mensajeError } from '../principal/textos';
import {
  ERROR_DIVISION_CATEGORIA,
  ERROR_DIVISION_ORIGEN,
  ERROR_DIVISION_REPARTO,
  ERROR_DIVISION_TOTAL,
  TEXTO_CONTACTOS_VACIO,
  textoFaltanPersonas,
} from './textos';

const PREGUNTA_CATEGORIA_PARTE = 'Categoría de tu parte';
const PREGUNTA_ORIGEN_DIVISION = '¿Con qué pagaste?';

export type RegistradoDivision = Extract<ResultadoTexto, { resultado: 'registrado_division' }>;

/**
 * Cuenta dividida (`02 §17`, E12.1): total, entre cuántos (tú incluido), con quién (chips de contactos, uno por
 * parte ajena), categoría y con qué pagaste. Sirve para el formulario y para confirmar lo dictado
 * (`prellenado`). El reparto lo calcula `servicios`; nada se guarda hasta "Guardar".
 */
export function FormularioCuentaDividida({
  prellenado,
  origen = 'manual',
  alGuardar,
  alCancelar,
}: {
  prellenado?: PropuestaCuentaDividida;
  origen?: OrigenDictado | 'manual';
  alGuardar: (r: RegistradoDivision) => void;
  alCancelar?: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const vistaCuentas = useVista(listarCuentas);
  const personas = useVista(listarPersonas);
  const categorias = useVista((c) => listarCategorias(c, 'gasto'));

  const [total, setTotal] = useState<Centavos | null>(prellenado?.total ?? null);
  const [partes, setPartes] = useState<number>(
    prellenado?.partes ?? Math.max(2, (prellenado?.personaIds.length ?? 0) + 1),
  );
  const [descripcion, setDescripcion] = useState(prellenado?.descripcion ?? '');
  const [categoria, setCategoria] = useState<string | null>(prellenado?.categoria ?? null);
  const [origenId, setOrigenId] = useState<string | null>(
    prellenado?.origenId ??
      (prellenado?.faltaOrigen?.motivo === 'aproximado' && prellenado.faltaOrigen.candidatas.length === 1
        ? (prellenado.faltaOrigen.candidatas[0]?.id ?? null)
        : null),
  );
  const [elegidas, setElegidas] = useState<string[]>([...(prellenado?.personaIds ?? [])]);
  const [porAgregar, setPorAgregar] = useState<string[]>([...(prellenado?.sinResolver ?? [])]);
  const [nuevaPersona, setNuevaPersona] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuentas = [
    ...vistaCuentas.tienes.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
    ...vistaCuentas.debes
      .filter((d) => d.tipo === 'tarjeta')
      .map((d) => ({ valor: d.id, etiqueta: d.nombre })),
  ];
  // Lo dictado sin método de pago llega con la cuenta puente "por asignar" (`06 §5`).
  if (prellenado?.origenId && !cuentas.some((c) => c.valor === prellenado.origenId)) {
    cuentas.push({ valor: prellenado.origenId, etiqueta: 'Todavía no sé' });
  }
  const ajenas = partes - 1;
  const reparto = repartoCuentaDividida(total, partes);

  const faltante = (): string | null => {
    if (total === null || total <= 0) return ERROR_DIVISION_TOTAL;
    if (!reparto) return ERROR_DIVISION_REPARTO;
    if (elegidas.length !== ajenas) return textoFaltanPersonas(ajenas, elegidas.length);
    if (!categoria) return ERROR_DIVISION_CATEGORIA;
    if (!origenId) return ERROR_DIVISION_ORIGEN;
    return null;
  };
  const pendiente = faltante();

  const alternar = (id: string) => {
    setElegidas((xs) => {
      if (xs.length < ajenas) return [...xs, id];
      const idx = xs.lastIndexOf(id);
      if (idx >= 0) return [...xs.slice(0, idx), ...xs.slice(idx + 1)];
      return xs;
    });
  };

  const vecesElegida = (id: string) => elegidas.filter((x) => x === id).length;

  const cambiarPartes = (n: number) => {
    const siguiente = Math.min(MAX_PARTES, Math.max(2, n));
    setPartes(siguiente);
    setElegidas((xs) => xs.slice(0, siguiente - 1));
  };

  const agregar = (nombre: string) => {
    const limpio = nombre.trim();
    if (limpio === '') return;
    try {
      const id = crearPersona(ctx, { nombre: limpio });
      setPorAgregar((xs) => xs.filter((x) => x !== nombre));
      setNuevaPersona('');
      setElegidas((xs) => (xs.length < ajenas ? [...xs, id] : xs));
      refrescar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const guardar = () => {
    setIntentado(true);
    if (pendiente || total === null || !categoria || !origenId) return;
    const falta = prellenado?.faltaOrigen;
    const alias =
      falta && falta.motivo !== 'ambigua' && origenId !== prellenado?.origenId ? falta.alias : null;
    try {
      alGuardar(
        confirmarCuentaDividida(
          ctx,
          {
            total,
            partes,
            personaIds: elegidas,
            origenId,
            categoria,
            ...(prellenado?.fecha ? { fecha: prellenado.fecha } : {}),
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
    <View style={{ gap: espacio.l }} testID="formulario-cuenta-dividida">
      <CampoMonto
        etiqueta="¿Cuánto fue en total?"
        valorInicial={prellenado?.total ?? null}
        alCambiar={setTotal}
        testID="division-total"
      />
      <CampoTexto
        etiqueta="¿Qué fue? (opcional)"
        valor={descripcion}
        alCambiar={setDescripcion}
        ejemplo="la cena"
        testID="division-descripcion"
      />
      <View style={{ gap: espacio.xs }}>
        <Texto variante="etiqueta">¿Entre cuántos? (contándote)</Texto>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
          <Boton
            etiqueta="−"
            etiquetaAccesible="Uno menos"
            variante="secundario"
            ancho="contenido"
            alPresionar={() => cambiarPartes(partes - 1)}
            deshabilitado={partes <= 2}
            testID="division-menos"
          />
          <Texto variante="cuerpoFuerte" testID="division-partes">{`Entre ${partes}`}</Texto>
          <Boton
            etiqueta="+"
            etiquetaAccesible="Uno más"
            variante="secundario"
            ancho="contenido"
            alPresionar={() => cambiarPartes(partes + 1)}
            deshabilitado={partes >= MAX_PARTES}
            testID="division-mas"
          />
        </View>
      </View>
      {reparto ? (
        <View style={{ gap: espacio.xxs }} testID="division-reparto">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Texto variante="cuerpo">Tu parte</Texto>
            <Cifra centavos={reparto.parteUsuario} contexto="Tu parte" testID="division-tu-parte" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Texto variante="cuerpo">Te deben en total</Texto>
            <Cifra
              centavos={reparto.porCobrarTotal}
              contexto="Te deben en total"
              testID="division-te-deben"
            />
          </View>
          <Texto variante="secundario" tono="secundario">
            {reparto.partesOtros.every((x) => x === reparto.partesOtros[0])
              ? `Cada quien te debe ${formatearCentavos(reparto.partesOtros[0] ?? 0)}. No cuenta como ingreso.`
              : `Cada quien te debe ${reparto.partesOtros.map((x) => formatearCentavos(x)).join(', ')}, en el orden en que los eliges. No cuenta como ingreso.`}
          </Texto>
        </View>
      ) : null}
      <View style={{ gap: espacio.xs }}>
        <Texto variante="etiqueta">¿Con quién?</Texto>
        <Texto variante="secundario" tono="secundario" testID="division-faltan">
          {textoFaltanPersonas(ajenas, elegidas.length)}
        </Texto>
        {personas.length === 0 ? (
          <Texto variante="cuerpo" tono="secundario" testID="division-contactos-vacio">
            {TEXTO_CONTACTOS_VACIO}
          </Texto>
        ) : null}
        <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
          {personas.map((p) => {
            const veces = vecesElegida(p.cuentaId);
            return (
              <Chip
                key={p.cuentaId}
                etiqueta={veces > 1 ? `${p.nombre} ×${veces}` : p.nombre}
                seleccionado={veces > 0}
                multiple
                alPresionar={() => alternar(p.cuentaId)}
                testID={`division-persona-${p.cuentaId}`}
              />
            );
          })}
        </View>
        {porAgregar.map((nombre) => (
          <Boton
            key={nombre}
            etiqueta={`No tengo a «${nombre}». Agregarlo`}
            variante="texto"
            ancho="contenido"
            alPresionar={() => agregar(nombre)}
            testID={`division-agregar-${nombre}`}
          />
        ))}
        <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <CampoTexto
              etiqueta="Agregar persona"
              valor={nuevaPersona}
              alCambiar={setNuevaPersona}
              ejemplo="Caro"
              alEnviar={() => agregar(nuevaPersona)}
              testID="division-nueva-persona"
            />
          </View>
          <Boton
            etiqueta="Agregar"
            variante="secundario"
            ancho="contenido"
            alPresionar={() => agregar(nuevaPersona)}
            deshabilitado={nuevaPersona.trim() === ''}
            testID="division-boton-agregar"
          />
        </View>
      </View>
      <View style={{ gap: espacio.xs }}>
        <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
          {PREGUNTA_CATEGORIA_PARTE}
        </Texto>
        <GrupoChips
          opciones={categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre }))}
          valor={categoria}
          alCambiar={setCategoria}
          prefijoTestID="division-categoria"
          etiqueta={PREGUNTA_CATEGORIA_PARTE}
        />
      </View>
      <View style={{ gap: espacio.xs }}>
        <Texto variante="etiqueta" {...OCULTAR_ETIQUETA_VISIBLE}>
          {PREGUNTA_ORIGEN_DIVISION}
        </Texto>
        {prellenado?.faltaOrigen?.motivo === 'no_encontrada' && prellenado.faltaOrigen.alias ? (
          <Texto variante="secundario" tono="secundario">
            {`No tengo una cuenta «${prellenado.faltaOrigen.alias}». ¿Con cuál fue?`}
          </Texto>
        ) : null}
        <GrupoChips
          opciones={cuentas}
          valor={origenId}
          alCambiar={setOrigenId}
          prefijoTestID="division-origen"
          etiqueta={PREGUNTA_ORIGEN_DIVISION}
        />
      </View>
      {intentado && pendiente ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {pendiente}
        </Texto>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar" alPresionar={guardar} testID="boton-guardar-division" />
      {alCancelar ? (
        <Boton
          etiqueta="Cancelar"
          variante="texto"
          alPresionar={alCancelar}
          testID="boton-cancelar-division"
        />
      ) : null}
    </View>
  );
}
