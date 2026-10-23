import { useEffect, useRef, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import { indiceTarjetaAccion, MAX_OBSERVACIONES, type TurnoConversacion } from '../../asistente/conversacion';
import type { FiltroMovimientos, Observacion, ResultadoTexto, TarjetaAccion } from '../../servicios';
import { anunciar, espacio, etiquetaHablada, margenPantalla } from '../../ui';
import { Observaciones } from '../principal/Observaciones';
import { TarjetasAccion } from '../principal/TarjetasAccion';
import { EntradaTurno } from './movimiento';
import { textoNoEntendi } from './textos';
import { TurnoAviso } from './turnos/TurnoAviso';
import { TurnoEntendi } from './turnos/TurnoEntendi';
import { TurnoNoEntendi } from './turnos/TurnoNoEntendi';
import { TurnoPersona } from './turnos/TurnoPersona';
import { TurnoPregunta } from './turnos/TurnoPregunta';
import { TurnoRegistro } from './turnos/TurnoRegistro';
import { TurnoTarjeta } from './turnos/TurnoTarjeta';
import { TurnoTexto } from './turnos/TurnoTexto';

/** Lo que el lector dice de cada turno nuevo del asistente (`ui/anunciar`, criterio 9); `null` si no se anuncia. */
export function textoAnunciable(t: TurnoConversacion): string | null {
  if (t.de !== 'asistente') return null;
  switch (t.clase) {
    case 'registro':
      return t.cambioDia ? `${t.texto} ${t.cambioDia}` : t.texto;
    case 'entendi':
      return [t.propuesta.titulo, ...t.propuesta.filas.map((f) => `${f.etiqueta}: ${f.valor}`)].join('. ');
    case 'pregunta':
    case 'aviso':
    case 'texto':
      return t.texto;
    case 'no_entendi':
      return textoNoEntendi(t.oido);
    case 'tarjeta':
      // Las tarjetas de siempre ya anuncian lo suyo (títulos y errores con región viva o `useAnuncio`).
      return null;
  }
}

/** testID estable de cada turno: el más reciente de cada clase lleva el nombre corto que usan Maestro y las pruebas. */
export function testIdsDeTurnos(
  turnos: readonly TurnoConversacion[],
  idsSesion: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const ids = new Map<string, string>();
  const ultimos = new Map<string, string>();
  for (const t of turnos) {
    if (t.de !== 'asistente') continue;
    // El «Registré…» con Deshacer es `aviso` (como el aviso inferior de antes); los del libro no.
    if (t.clase === 'registro' && !idsSesion.has(t.id)) continue;
    ultimos.set(t.clase, t.id);
  }
  const corto: Record<string, string> = {
    registro: 'aviso',
    entendi: 'entendi',
    no_entendi: 'no-entendi',
    pregunta: 'pregunta',
    texto: 'respuesta',
  };
  for (const t of turnos) {
    let id = `turno-${t.id}`;
    if (t.de === 'asistente') {
      const nombre = corto[t.clase];
      if (nombre && ultimos.get(t.clase) === t.id) id = nombre;
      else if (t.clase === 'aviso' && !idsSesion.has(t.id)) id = t.id;
    }
    ids.set(t.id, id);
  }
  return ids;
}

/**
 * Anuncia al lector cada turno del asistente que aparece (o cambia, como «Deshice el registro») después de abrir la
 * pantalla, con las cifras en palabras (criterio 9), y dice cuáles son nuevos (para animar su entrada). Va en el
 * cuerpo de la pantalla, que está montado desde el principio (también mientras se ve el estado vacío).
 */
export function useTurnosNuevos(turnos: readonly TurnoConversacion[]): (id: string) => boolean {
  const iniciales = useRef<ReadonlySet<string> | null>(null);
  iniciales.current ??= new Set(turnos.map((t) => t.id));
  const vistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    const primera = vistos.current === null;
    const conocidos = (vistos.current ??= new Set());
    for (const t of turnos) {
      const texto = textoAnunciable(t);
      if (!texto) continue;
      const clave = `${t.id}:${texto}`;
      if (conocidos.has(clave)) continue;
      conocidos.add(clave);
      if (!primera) anunciar(etiquetaHablada(texto));
    }
  }, [turnos]);
  return (id) => !iniciales.current?.has(id);
}

/**
 * La conversación (§2): FlatList que siempre termina en lo último, con el teclado empujándola (el contenedor de la
 * pantalla) y toques que no se pierden con el teclado abierto.
 */
export function Conversacion({
  turnos,
  idsSesion,
  tarjetasAccion,
  observaciones,
  alVerMovimientosFiltro,
  encabezado,
  alVerMovimientos,
  alAbrirArqueo,
  alResultadoTarjeta,
  alListoTarjeta,
  alCancelarTarjeta,
  virtualizada = true,
  esNuevo,
  alEscribir,
}: {
  /** Abre el campo de la barra de voz (respuestas escritas a una pregunta). */
  alEscribir?: () => void;
  /** `false` dentro de otra pantalla desplazable (sin listas virtualizadas anidadas). */
  virtualizada?: boolean;
  /** El turno llegó después de abrir la pantalla (`useTurnosNuevos`): entra con movimiento. */
  esNuevo?: (id: string) => boolean;
  turnos: readonly TurnoConversacion[];
  idsSesion: ReadonlySet<string>;
  /** Las tarjetas de acción de `VistaHoy` (sus turnos se pintan con la tarjeta interactiva de siempre). */
  tarjetasAccion: readonly TarjetaAccion[];
  /** «Lo que veo» de `servicios/observaciones` (sus turnos se pintan con la tarjeta de siempre). */
  observaciones?: readonly Observacion[];
  /** «Ver movimientos» con el filtro de una observación. */
  alVerMovimientosFiltro?: (filtro: FiltroMovimientos) => void;
  encabezado?: ReactElement | null;
  alVerMovimientos: () => void;
  alAbrirArqueo?: () => void;
  alResultadoTarjeta: (id: string, r: ResultadoTexto) => void;
  alListoTarjeta: (id: string, mensaje: string) => void;
  alCancelarTarjeta: (id: string) => void;
}) {
  const lista = useRef<FlatList<TurnoConversacion>>(null);
  const testIds = testIdsDeTurnos(turnos, idsSesion);
  const pregunta = [...turnos].reverse().find((t) => t.de === 'asistente');
  const preguntaActiva = pregunta?.de === 'asistente' && pregunta.clase === 'pregunta' ? pregunta.id : null;

  // Los turnos que ya estaban al abrir la pantalla no se animan; los que llegan después entran con movimiento sutil.
  const animado = (t: TurnoConversacion, nodo: ReactElement | null) =>
    nodo ? <EntradaTurno animar={esNuevo?.(t.id) ?? false}>{nodo}</EntradaTurno> : null;

  const pintar = (t: TurnoConversacion): ReactElement | null => {
    const testID = testIds.get(t.id) ?? `turno-${t.id}`;
    if (t.de === 'persona') return <TurnoPersona turno={t} testID={testID} />;
    switch (t.clase) {
      case 'registro':
        return <TurnoRegistro turno={t} testID={testID} />;
      case 'entendi':
        return <TurnoEntendi turno={t} testID={testID} />;
      case 'pregunta':
        return (
          <TurnoPregunta
            turno={t}
            testID={testID}
            activa={t.id === preguntaActiva}
            {...(alEscribir ? { alEscribir } : {})}
          />
        );
      case 'no_entendi':
        return <TurnoNoEntendi turno={t} testID={testID} />;
      case 'texto':
        return <TurnoTexto turno={t} testID={testID} />;
      case 'tarjeta':
        return (
          <TurnoTarjeta
            turno={t}
            alResultado={(r) => alResultadoTarjeta(t.id, r)}
            alListo={(m) => alListoTarjeta(t.id, m)}
            alCancelar={() => alCancelarTarjeta(t.id)}
          />
        );
      case 'aviso': {
        // «Lo que veo» conserva su cifra grande, su etiqueta hablada completa y sus botones: las dos observaciones
        // se pintan juntas, con su título, donde va la primera.
        if (t.origen === 'observacion' && /^observacion-\d+$/.test(t.id) && observaciones) {
          if (t.id !== 'observacion-0') return null;
          return (
            <Observaciones
              observaciones={observaciones.slice(0, MAX_OBSERVACIONES)}
              alVerMovimientos={alVerMovimientosFiltro ?? (() => alVerMovimientos())}
            />
          );
        }
        const i = t.origen === 'tarjeta_accion' ? indiceTarjetaAccion(t.id) : null;
        if (i === null) return <TurnoAviso turno={t} testID={testID} />;
        // Las tarjetas de acción conservan su interacción (pagar, elegir cuenta, liquidar meses…) y sus testID: se
        // pintan juntas donde va la primera.
        if (i !== 0) return null;
        return (
          <TarjetasAccion
            tarjetas={tarjetasAccion}
            alVerMovimientos={alVerMovimientos}
            {...(alAbrirArqueo ? { alAbrirArqueo } : {})}
          />
        );
      }
    }
  };

  if (!virtualizada) {
    return (
      <View testID="conversacion" style={{ gap: espacio.m }}>
        {encabezado ?? null}
        {turnos.map((t) => (
          <View key={t.id}>{animado(t, pintar(t))}</View>
        ))}
      </View>
    );
  }
  return (
    <FlatList
      ref={lista}
      testID="conversacion"
      data={turnos as TurnoConversacion[]}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => animado(item, pintar(item))}
      ListHeaderComponent={encabezado ?? null}
      ItemSeparatorComponent={Separador}
      contentContainerStyle={{ padding: margenPantalla, paddingBottom: espacio.l }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // Pocas decenas de turnos: se pintan todos (el lector y las pruebas los alcanzan sin desplazar).
      initialNumToRender={Math.max(10, turnos.length)}
      onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
    />
  );
}

function Separador() {
  return <View style={{ height: espacio.m }} />;
}
