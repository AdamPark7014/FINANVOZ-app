import { useState } from 'react';
import { View } from 'react-native';
import {
  aplicarEleccion,
  etiquetaDiaMes,
  type AccionElegir,
  type MovimientoVista,
  type OrigenDictado,
  type ResultadoTexto,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from './Chip';
import { MENSAJE_ERROR_GENERAL, NOMBRE_TIPO_LIBRO } from './textos';

type Elegir = Extract<ResultadoTexto, { resultado: 'elegir' }>;
type Duplicados = Extract<ResultadoTexto, { resultado: 'duplicados' }>;
type Aclarar = Extract<ResultadoTexto, { resultado: 'aclarar' }>;

const TITULO_ELEGIR: Record<AccionElegir, string> = {
  corregir: '¿Cuál quieres corregir?',
  anular: '¿Cuál quieres borrar?',
  pasar_a_meses: '¿Cuál pasaste a meses?',
};

function nombre(m: MovimientoVista): string {
  return m.descripcion ?? m.comercio ?? m.categoria ?? NOMBRE_TIPO_LIBRO[m.tipo] ?? 'Movimiento';
}

/** "Tacos $80 · 11 oct · Nu" */
function etiquetaMovimiento(m: MovimientoVista): string {
  const cuenta = [...m.saleDe, ...m.llegaA][0];
  return [`${nombre(m)} ${formatearCentavos(m.monto)}`, etiquetaDiaMes(m.fecha), cuenta]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Corregir, borrar o pasar a meses cuando hay varias coincidencias, una de hace más de 48 h o falta la cuenta
 * nueva (`06 §7`): chips con los movimientos (y con las cuentas) y "Guardar".
 */
export function TarjetaElegir({
  datos,
  origen,
  alTerminar,
  alCancelar,
}: {
  datos: Elegir;
  origen: OrigenDictado;
  alTerminar: (r: ResultadoTexto) => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const [movimiento, setMovimiento] = useState<string | null>(
    datos.candidatos.length === 1 ? (datos.candidatos[0]?.id ?? null) : null,
  );
  const falta = datos.faltaCuenta;
  const [cuenta, setCuenta] = useState<string | null>(
    falta?.motivo === 'aproximado' && falta.candidatas.length === 1
      ? (falta.candidatas[0]?.id ?? null)
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const completo = movimiento !== null && (!falta || cuenta !== null);

  const guardar = () => {
    if (!movimiento) return;
    const cambios =
      falta && cuenta ? { ...datos.cambios, origenId: cuenta, aliasDicho: falta.alias } : datos.cambios;
    try {
      alTerminar(
        aplicarEleccion(
          ctx,
          {
            accion: datos.accion,
            transaccionId: movimiento,
            ...(cambios ? { cambios } : {}),
            ...(datos.meses ? { meses: datos.meses } : {}),
          },
          origen,
        ),
      );
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };

  return (
    <Tarjeta testID="tarjeta-elegir">
      <Texto variante="subtitulo">{TITULO_ELEGIR[datos.accion]}</Texto>
      <GrupoChips
        opciones={datos.candidatos.map((m) => ({ valor: m.id, etiqueta: etiquetaMovimiento(m) }))}
        valor={movimiento}
        alCambiar={setMovimiento}
        prefijoTestID="elegir-movimiento"
      />
      {falta ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario">
            {falta.motivo === 'no_encontrada' && falta.alias
              ? `No tengo una cuenta «${falta.alias}». ¿Cuál fue?`
              : '¿Con qué cuenta fue?'}
          </Texto>
          <GrupoChips
            opciones={falta.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            valor={cuenta}
            alCambiar={setCuenta}
            prefijoTestID="elegir-cuenta"
          />
        </View>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={datos.accion === 'anular' ? 'Borrar' : 'Guardar'}
        alPresionar={guardar}
        deshabilitado={!completo}
        testID="boton-guardar-eleccion"
      />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID="boton-cancelar-eleccion" />
    </Tarjeta>
  );
}

/** "Creo que anoté dos veces la gasolina": los movimientos iguales, cada uno con "Borrar este". */
export function TarjetaDuplicados({
  datos,
  origen,
  alTerminar,
  alCerrar,
}: {
  datos: Duplicados;
  origen: OrigenDictado;
  alTerminar: (r: ResultadoTexto) => void;
  alCerrar: () => void;
}) {
  const { ctx } = useSesion();
  const [error, setError] = useState<string | null>(null);
  return (
    <Tarjeta testID="tarjeta-duplicados">
      <Texto variante="subtitulo">Estos se parecen. ¿Alguno está repetido?</Texto>
      {datos.grupos.map((grupo, g) => (
        <View key={g} style={{ gap: espacio.s }}>
          {grupo.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: espacio.s,
              }}
            >
              <View style={{ flex: 1 }}>
                <Texto variante="cuerpoFuerte">{nombre(m)}</Texto>
                <Texto variante="secundario" tono="secundario">
                  {[etiquetaDiaMes(m.fecha), ...m.saleDe, ...m.llegaA].join(' · ')}
                </Texto>
              </View>
              <Cifra centavos={m.monto} />
              <Boton
                etiqueta="Borrar este"
                variante="secundario"
                ancho="contenido"
                alPresionar={() => {
                  try {
                    alTerminar(aplicarEleccion(ctx, { accion: 'anular', transaccionId: m.id }, origen));
                  } catch {
                    setError(MENSAJE_ERROR_GENERAL);
                  }
                }}
                testID={`borrar-duplicado-${m.id}`}
              />
            </View>
          ))}
        </View>
      ))}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Están bien" variante="texto" alPresionar={alCerrar} testID="boton-cerrar-duplicados" />
    </Tarjeta>
  );
}

/** Una sola pregunta con opciones tocables (RF-REG-05). Elegir una vuelve a interpretar la frase con ella. */
export function TarjetaAclarar({
  datos,
  alElegir,
  alCancelar,
}: {
  datos: Aclarar;
  alElegir: (frase: string) => void;
  alCancelar: () => void;
}) {
  return (
    <Tarjeta testID="tarjeta-aclarar">
      <Texto variante="subtitulo">{datos.pregunta}</Texto>
      {datos.opciones.length > 0 ? (
        <GrupoChips
          opciones={datos.opciones.map((o) => ({ valor: o, etiqueta: o }))}
          valor={null}
          alCambiar={(o) => alElegir(`${datos.texto}, ${o}`)}
          prefijoTestID="aclarar"
        />
      ) : (
        <Texto variante="secundario" tono="secundario">
          Dímelo otra vez con ese dato.
        </Texto>
      )}
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID="boton-cancelar-aclarar" />
    </Tarjeta>
  );
}
