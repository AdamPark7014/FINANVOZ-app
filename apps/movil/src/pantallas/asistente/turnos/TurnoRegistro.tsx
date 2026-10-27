import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';
import type { CambioRegistro, Turno } from '../../../asistente/tipos';
import { mensajeError } from '../../../servicios';
import {
  AnilloTiempo,
  DURACION_AVISO_MS,
  espacio,
  etiquetaHablada,
  Icono,
  iconoDeCategoria,
  OBJETIVO_TACTIL_MIN,
  Texto,
  useTema,
} from '../../../ui';
import { BotonPildora } from '../../../ui/componentes/BotonPildora';
import {
  BTN_DESHACER,
  etiquetaChipRegistro,
  NOMBRE_CAMBIO_REGISTRO,
  PISTA_DESHACER,
  separarCambioDia,
  tituloRegistro,
} from '../textos';
import { Burbuja } from './Burbuja';

/** Cada cuánto se redibuja el anillo de «Deshacer». */
const PASO_ANILLO_MS = 250;

/**
 * Lo que se acaba de registrar. Con los datos del movimiento (tablero B2 con los chips de C2): «Listo, lo
 * registré.» y la tarjeta con el ícono de la categoría, qué y cuánto, «Antojos · Efectivo · hoy», «Tu día pasa de
 * $275 a $268.», los chips de un toque (categoría · cuenta · día: elegir otra opción corrige el movimiento, regla 2)
 * y «Deshacer» con su anillo de tiempo. Sin esos datos (varios movimientos, un ajuste, los del libro), la frase
 * «Registré…» con Deshacer. Tocar la frase abre el movimiento. Si Deshacer o un cambio fallan, el error se queda.
 */
export function TurnoRegistro({
  turno,
  testID,
  compacto = false,
  ultimo = false,
}: {
  turno: Extract<Turno, { clase: 'registro' }>;
  testID: string;
  /** En la conversación, lo que ya estaba antes de esta sesión se dice en chico y sin botones (B2). */
  compacto?: boolean;
  /** Es el último registro de la sesión: debajo va «Si oí mal, solo dime…» (B2). */
  ultimo?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const deshacer = turno.deshacer;
  const intentar = (accion: () => void | Promise<void>) => {
    setError(null);
    Promise.resolve()
      .then(() => accion())
      .catch((e: unknown) => setError(mensajeError(e)));
  };
  if (compacto) return <TurnoCompacto texto={turno.texto} testID={testID} />;
  if (turno.movimiento) {
    return (
      <TarjetaRegistro
        turno={turno}
        testID={testID}
        ultimo={ultimo}
        error={error}
        alDeshacer={deshacer ? () => intentar(deshacer) : null}
        alCambiar={(cambio, valor) => intentar(() => cambio.elegir(valor))}
      />
    );
  }
  const texto = (
    <Texto
      variante="cuerpo"
      testID={`${testID}-texto`}
      style={{ fontSize: 20, lineHeight: 28, fontWeight: '500' }}
    >
      {turno.texto}
    </Texto>
  );
  return (
    <Burbuja testID={testID}>
      {turno.abrir ? (
        <Pressable
          onPress={turno.abrir}
          accessibilityRole="button"
          accessibilityLabel={etiquetaHablada(turno.texto)}
          accessibilityHint="Abre el movimiento"
          style={{ minHeight: OBJETIVO_TACTIL_MIN, justifyContent: 'center' }}
        >
          {texto}
        </Pressable>
      ) : (
        texto
      )}
      {turno.detalle ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-detalle`}>
          {turno.detalle}
        </Texto>
      ) : null}
      {turno.cambioDia ? (
        <Texto variante="cuerpo" testID={`${testID}-cambio`}>
          {turno.cambioDia}
        </Texto>
      ) : null}
      {deshacer ? (
        <BotonDeshacer
          testID={`${testID}-deshacer`}
          alPresionar={() => intentar(deshacer)}
          ancho="contenido"
        />
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
    </Burbuja>
  );
}

/** Lo dicho antes de esta sesión, en chico y sin botones (tablero B2). */
export function TurnoCompacto({ texto, testID }: { texto: string; testID: string }) {
  const { c } = useTema();
  return (
    <Text
      testID={testID}
      accessibilityLabel={etiquetaHablada(texto)}
      style={{ fontSize: 17, lineHeight: 24, fontWeight: '500', color: c.textoSecundario, paddingRight: 32 }}
    >
      {texto}
    </Text>
  );
}

function TarjetaRegistro({
  turno,
  testID,
  ultimo,
  error,
  alDeshacer,
  alCambiar,
}: {
  turno: Extract<Turno, { clase: 'registro' }>;
  testID: string;
  ultimo: boolean;
  error: string | null;
  alDeshacer: (() => void) | null;
  alCambiar: (cambio: CambioRegistro, valor: string) => void;
}) {
  const { c } = useTema();
  const m = turno.movimiento;
  const [abierto, setAbierto] = useState<CambioRegistro['clave'] | null>(null);
  if (!m) return null;
  const cambios = turno.cambios ?? [];
  const elegido = cambios.find((x) => x.clave === abierto) ?? null;
  const partesCambio = turno.cambioDia ? separarCambioDia(turno.cambioDia) : null;
  const cuenta = m.cuenta ? [m.cuenta] : [];
  const subtitulo = [m.categoria, ...cuenta, m.cuando].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: espacio.m }}>
      <Texto
        variante="subtitulo"
        accessibilityRole="text"
        style={{ fontSize: 22, lineHeight: 28, fontWeight: '600' }}
      >
        {tituloRegistro(turno.corregido === true)}
      </Texto>
      <View
        testID={testID}
        accessibilityRole="summary"
        style={{
          backgroundColor: c.superficie,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: c.borde,
          padding: 18,
          gap: 14,
        }}
      >
        <Pressable
          testID={`${testID}-texto`}
          disabled={!turno.abrir}
          {...(turno.abrir ? { onPress: turno.abrir } : {})}
          accessibilityRole={turno.abrir ? 'button' : 'text'}
          accessibilityLabel={etiquetaHablada(turno.texto)}
          {...(turno.abrir ? { accessibilityHint: 'Abre el movimiento' } : {})}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.m,
            minHeight: OBJETIVO_TACTIL_MIN,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: c.iconoFondo,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icono nombre={iconoDeCategoria(m.categoriaSlug)} color={c.acento} tamano={24} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 19, lineHeight: 24, fontWeight: '700', color: c.texto }}>
              {m.descripcion}
            </Text>
            {subtitulo ? (
              <Text style={{ fontSize: 15, lineHeight: 20, color: c.textoSecundario }}>{subtitulo}</Text>
            ) : null}
          </View>
          <Text
            style={{
              fontSize: 28,
              lineHeight: 34,
              fontWeight: '800',
              color: c.texto,
              fontVariant: ['tabular-nums'],
            }}
          >
            {m.montoTexto}
          </Text>
        </Pressable>
        {cambios.length > 0 ? (
          <View style={{ gap: espacio.s }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
              {cambios.map((x) => (
                <Pressable
                  key={x.clave}
                  testID={`${testID}-chip-${x.clave}`}
                  onPress={() => setAbierto(abierto === x.clave ? null : x.clave)}
                  hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
                  accessibilityRole="button"
                  accessibilityLabel={etiquetaChipRegistro(NOMBRE_CAMBIO_REGISTRO[x.clave], x.actual)}
                  accessibilityState={{ expanded: abierto === x.clave }}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: 22,
                    paddingLeft: 14,
                    paddingRight: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: espacio.xs,
                    backgroundColor: abierto === x.clave ? c.iconoFondo : c.superficieAlterna,
                    borderWidth: abierto === x.clave ? 1.5 : 0,
                    borderColor: c.acento,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '600', color: c.texto }}>
                    {x.actual}
                  </Text>
                  <View style={{ transform: [{ rotate: abierto === x.clave ? '180deg' : '0deg' }] }}>
                    <Icono nombre="chevronAbajo" color={c.textoSecundario} tamano={16} grosor={2.4} />
                  </View>
                </Pressable>
              ))}
            </View>
            {elegido ? (
              <ScrollView
                horizontal={elegido.opciones.length > 6}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  flexDirection: 'row',
                  flexWrap: elegido.opciones.length > 6 ? 'nowrap' : 'wrap',
                  gap: espacio.s,
                }}
                testID={`${testID}-opciones-${elegido.clave}`}
              >
                {elegido.opciones.map((o) => {
                  const actual = o.valor === elegido.valor;
                  return (
                    <Pressable
                      key={o.valor}
                      testID={`${testID}-opcion-${elegido.clave}-${o.valor}`}
                      hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
                      onPress={() => {
                        setAbierto(null);
                        if (!actual) alCambiar(elegido, o.valor);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={o.etiqueta}
                      accessibilityState={{ selected: actual }}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        borderRadius: 22,
                        paddingHorizontal: espacio.l,
                        justifyContent: 'center',
                        backgroundColor: actual ? c.acento : c.superficie,
                        borderWidth: 1,
                        borderColor: actual ? c.acento : c.bordeControl,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          lineHeight: 20,
                          fontWeight: actual ? '700' : '600',
                          color: actual ? c.sobreAcento : c.texto,
                        }}
                      >
                        {o.etiqueta}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
        {partesCambio ? (
          <Text
            testID={`${testID}-cambio`}
            accessibilityLabel={etiquetaHablada(turno.cambioDia ?? '')}
            style={{ fontSize: 17, lineHeight: 24, color: c.texto }}
          >
            {partesCambio.antes}
            <Text style={{ fontWeight: '700', color: c.acentoTexto }}>{partesCambio.despues}</Text>
            {partesCambio.final}
          </Text>
        ) : turno.cambioDia ? (
          <Text
            testID={`${testID}-cambio`}
            accessibilityLabel={etiquetaHablada(turno.cambioDia ?? '')}
            style={{ fontSize: 17, lineHeight: 24, color: c.texto }}
          >
            {turno.cambioDia}
          </Text>
        ) : null}
        {alDeshacer ? <BotonDeshacer testID={`${testID}-deshacer`} alPresionar={alDeshacer} /> : null}
        {error ? (
          <Texto variante="secundario" tono="faltante" accessibilityRole="alert">
            {error}
          </Texto>
        ) : null}
      </View>
      {ultimo && turno.pista ? (
        <Texto variante="cuerpo" tono="secundario" testID={`${testID}-pista`} style={{ fontWeight: '500' }}>
          {turno.pista}
        </Texto>
      ) : null}
    </View>
  );
}

/**
 * «Deshacer» con el anillo que marca el tiempo (B2): se va solo a los 10 s (lo que pida Android si es más), salvo
 * con lector de pantalla, que se queda (`DURACION_AVISO_MS`, como el aviso de antes).
 */
function BotonDeshacer({
  alPresionar,
  testID,
  ancho = 'lleno',
}: {
  alPresionar: () => void;
  testID: string;
  ancho?: 'lleno' | 'contenido';
}) {
  const { c } = useTema();
  const [restante, setRestante] = useState(DURACION_AVISO_MS);
  const [lector, setLector] = useState(false);
  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (vigente) setLector(v === true);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);
  useEffect(() => {
    if (lector) return;
    const t = setInterval(() => setRestante((r) => Math.max(0, r - PASO_ANILLO_MS)), PASO_ANILLO_MS);
    return () => clearInterval(t);
  }, [lector]);
  if (!lector && restante <= 0) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      <BotonPildora
        etiqueta={BTN_DESHACER}
        pista={PISTA_DESHACER}
        alto={48}
        ancho={ancho}
        icono={
          <AnilloTiempo parte={lector ? 1 : restante / DURACION_AVISO_MS} color={c.acento} riel={c.borde} />
        }
        alPresionar={alPresionar}
        testID={testID}
      />
    </View>
  );
}
