import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';
import type { CambioRegistro, Turno } from '../../../asistente/tipos';
import { mensajeError, RACHA_MINIMA, rachaAnotando } from '../../../servicios';
import {
  FUENTE,
  AnilloTiempo,
  BarraDelDia,
  CifraQueCuenta,
  coloresCategoria,
  coloresDinero,
  DURACION_AVISO_MS,
  espacio,
  etiquetaHablada,
  familiaDeCategoria,
  formatearCentavos,
  Icono,
  Mosaico,
  OBJETIVO_TACTIL_MIN,
  Orbe,
  Texto,
  useTema,
  type NombreIcono,
} from '../../../ui';
import { BotonPildora } from '../../../ui/componentes/BotonPildora';
import { useVista } from '../../../sesion/ProveedorSesion';
import {
  BTN_DESHACER,
  etiquetaChipRegistro,
  NOMBRE_CAMBIO_REGISTRO,
  PISTA_DESHACER,
  separarCambioDia,
  TEXTO_TU_DIA,
  textoRacha,
  tituloRegistro,
} from '../textos';
import { Burbuja } from './Burbuja';

/** Cada cuánto se redibuja el anillo de «Deshacer». */
const PASO_ANILLO_MS = 250;

/**
 * Lo que se acaba de registrar. Con los datos del movimiento (tablero B2 con los chips de C2, vivo en B+ D3): el orbe
 * con «Listo, lo registré.» y la tarjeta con el mosaico de la categoría, qué y cuánto, «Hoy, 9:41», «Tu día $275 →
 * $268» con la barra que se recorta (y «Tu día pasa de $275 a $268.» para el lector), los chips de un toque (categoría · cuenta · día: elegir otra opción corrige el movimiento, regla 2)
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
      style={{
        fontFamily: FUENTE,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: '500',
        color: c.textoSecundario,
        paddingRight: 32,
      }}
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
  const { c, esquema } = useTema();
  const m = turno.movimiento;
  const [abierto, setAbierto] = useState<CambioRegistro['clave'] | null>(null);
  // B+ (D3): la racha se dice bajo el último registro, desde 3 días seguidos.
  const racha = useVista(rachaAnotando);
  if (!m) return null;
  const cambios = turno.cambios ?? [];
  const elegido = cambios.find((x) => x.clave === abierto) ?? null;
  const partesCambio = turno.cambioDia ? separarCambioDia(turno.cambioDia) : null;
  const cuenta = m.cuenta ? [m.cuenta] : [];
  const subtitulo = m.cuandoHora ?? [m.categoria, ...cuenta, m.cuando].filter(Boolean).join(' · ');
  const dia = turno.dia;
  const dinero = coloresDinero[esquema];
  const conRacha = ultimo && racha >= RACHA_MINIMA;
  return (
    <View style={{ gap: espacio.m }}>
      {/* D3: el orbe contesta. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
        <Orbe tamano={34} estado={ultimo ? 'reposo' : 'quieto'} testID={`${testID}-orbe`} />
        <Texto
          variante="subtitulo"
          accessibilityRole="text"
          style={{ flexShrink: 1, fontSize: 22, lineHeight: 28, fontWeight: '600' }}
        >
          {tituloRegistro(turno.corregido === true)}
        </Texto>
      </View>
      <View>
        <View
          testID={testID}
          accessibilityRole="summary"
          style={{
            backgroundColor: c.superficie,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: c.borde,
            padding: 18,
            paddingBottom: conRacha ? 30 : 18,
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
            {/* B+ (D3): el mosaico de color de la categoría. */}
            <Mosaico slug={m.categoriaSlug} tamano={52} testID={`${testID}-mosaico`} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: FUENTE,
                  fontSize: 20,
                  lineHeight: 26,
                  fontWeight: '700',
                  color: c.texto,
                }}
              >
                {m.descripcion}
              </Text>
              {subtitulo ? (
                <Text style={{ fontFamily: FUENTE, fontSize: 15, lineHeight: 20, color: c.textoSecundario }}>
                  {subtitulo}
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                fontFamily: FUENTE,
                fontSize: 30,
                lineHeight: 36,
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
                      gap: 6,
                      backgroundColor: abierto === x.clave ? c.iconoFondo : c.superficieAlterna,
                      borderWidth: abierto === x.clave ? 1.5 : 0,
                      borderColor: c.acento,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {x.clave === 'categoria' ? (
                      // D3: el punto del color de la categoría.
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: coloresCategoria[esquema][familiaDeCategoria(x.valor)].barra,
                        }}
                      />
                    ) : x.clave === 'cuenta' ? (
                      <Icono nombre={iconoDeCuenta(m.cuentaClase ?? null)} color={c.texto} tamano={17} />
                    ) : null}
                    <Text
                      style={{
                        fontFamily: FUENTE,
                        fontSize: 15,
                        lineHeight: 20,
                        fontWeight: '600',
                        color: c.texto,
                      }}
                    >
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
                            fontFamily: FUENTE,
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
          {dia ? (
            // B+ (D3): «Tu día $275 → $268» y la barra que se recorta; la cifra nueva cuenta hasta su valor.
            <View
              testID={`${testID}-cambio`}
              accessible
              accessibilityLabel={etiquetaHablada(turno.cambioDia ?? '')}
              style={{
                gap: espacio.s,
                paddingTop: espacio.m,
                borderTopWidth: 1,
                borderTopColor: c.superficieAlterna,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  columnGap: espacio.s,
                }}
              >
                <Text
                  style={{
                    fontFamily: FUENTE,
                    fontSize: 15,
                    lineHeight: 20,
                    fontWeight: '600',
                    color: c.textoSecundario,
                  }}
                >
                  {TEXTO_TU_DIA}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: FUENTE,
                      fontSize: 17,
                      lineHeight: 22,
                      fontWeight: '700',
                      color: c.textoSecundario,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatearCentavos(dia.antes, 'pesos')}
                  </Text>
                  <Text
                    style={{ fontFamily: FUENTE, fontSize: 15, lineHeight: 20, color: c.textoSecundario }}
                  >
                    →
                  </Text>
                  <CifraQueCuenta
                    testID={`${testID}-cambio-despues`}
                    desde={dia.antes}
                    hasta={dia.despues}
                    style={{
                      fontFamily: FUENTE,
                      fontSize: 17,
                      lineHeight: 22,
                      fontWeight: '800',
                      color: c.acentoTexto,
                    }}
                  />
                </View>
              </View>
              <BarraDelDia
                testID={`${testID}-barra-dia`}
                antes={dia.antes}
                despues={dia.despues}
                lleno={dinero.libre}
                recorte={dinero.recorte}
                riel={c.superficieAlterna}
              />
            </View>
          ) : partesCambio ? (
            <Text
              testID={`${testID}-cambio`}
              accessibilityLabel={etiquetaHablada(turno.cambioDia ?? '')}
              style={{ fontFamily: FUENTE, fontSize: 17, lineHeight: 24, color: c.texto }}
            >
              {partesCambio.antes}
              <Text style={{ fontFamily: FUENTE, fontWeight: '700', color: c.acentoTexto }}>
                {partesCambio.despues}
              </Text>
              {partesCambio.final}
            </Text>
          ) : turno.cambioDia ? (
            <Text
              testID={`${testID}-cambio`}
              accessibilityLabel={etiquetaHablada(turno.cambioDia ?? '')}
              style={{ fontFamily: FUENTE, fontSize: 17, lineHeight: 24, color: c.texto }}
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
        {conRacha ? <Racha dias={racha} testID={`${testID}-racha`} /> : null}
      </View>
      {ultimo && turno.pista ? (
        <Texto variante="cuerpo" tono="secundario" testID={`${testID}-pista`} style={{ fontWeight: '500' }}>
          {turno.pista}
        </Texto>
      ) : null}
    </View>
  );
}

/** Ícono del chip de la cuenta (D3): billete para el efectivo, banco para débito, tarjeta para el crédito. */
function iconoDeCuenta(clase: 'efectivo' | 'liquida' | 'tarjeta' | null): NombreIcono {
  return clase === 'efectivo' ? 'billete' : clase === 'tarjeta' ? 'tarjeta' : 'banco';
}

/** «6 días seguidos anotando todo» con la llama (D3): una píldora ámbar montada en el borde de abajo de la tarjeta. */
function Racha({ dias, testID }: { dias: number; testID: string }) {
  const { esquema } = useTema();
  const p = coloresCategoria[esquema].antojos;
  const fuego = coloresCategoria[esquema].comidaFuera.barra;
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        marginTop: -18,
        marginLeft: espacio.s,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: p.mosaico,
        borderRadius: 999,
        paddingHorizontal: espacio.m,
        paddingVertical: 6,
      }}
    >
      <Icono nombre="llama" color={fuego} tamano={16} grosor={2.2} />
      <Text style={{ fontFamily: FUENTE, fontSize: 14, lineHeight: 20, fontWeight: '700', color: p.icono }}>
        {textoRacha(dias)}
      </Text>
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
