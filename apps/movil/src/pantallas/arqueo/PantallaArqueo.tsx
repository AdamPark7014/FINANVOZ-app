import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  calcularArqueo,
  confirmarArqueo,
  listarCuentas,
  prepararArqueo,
  type CalculoArqueo,
  type RespuestaSobrante,
  type VistaArqueo,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, Cifra, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { Casilla } from '../onboarding/componentes';
import { GrupoChips } from '../principal/Chip';
import { MENSAJE_ERROR_GENERAL } from '../principal/textos';

type Paso = 'marcar' | 'cantidad' | 'resultado';

/**
 * Arqueo de efectivo (`02 §7`, E7, CA-M5-05): (1) solo con gastos por asignar de más de 24 h, "¿pagaste alguno
 * de estos en efectivo?"; (2) "Deberías traer $640. ¿Cuánto traes?"; (3) faltante con la lista editable o
 * sobrante con su pregunta. Nada se registra hasta "Confirmar".
 */
export function PantallaArqueo({
  cuentaId,
  efectivoInicial,
  alCerrar,
}: {
  cuentaId?: string;
  /** "Traigo 300": la cantidad dicha ya escrita. */
  efectivoInicial?: Centavos;
  alCerrar: () => void;
}) {
  const vista = useVista((ctx) => {
    try {
      return prepararArqueo(ctx, cuentaId);
    } catch {
      return null;
    }
  });
  return (
    <Pantalla testID="pantalla-arqueo">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Texto variante="titulo">Contar mi efectivo</Texto>
        <Boton
          etiqueta="Cerrar"
          variante="texto"
          ancho="contenido"
          alPresionar={alCerrar}
          testID="boton-cerrar-arqueo"
        />
      </View>
      {vista ? (
        <Arqueo
          vista={vista}
          {...(efectivoInicial !== undefined ? { efectivoInicial } : {})}
          alCerrar={alCerrar}
        />
      ) : (
        <Texto variante="cuerpo" tono="secundario" testID="arqueo-sin-efectivo">
          No llevas una cuenta de efectivo. Agrégala en Cuentas para poder contarla.
        </Texto>
      )}
    </Pantalla>
  );
}

function Arqueo({
  vista,
  efectivoInicial,
  alCerrar,
}: {
  vista: VistaArqueo;
  efectivoInicial?: Centavos;
  alCerrar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  // La vista se lee una vez: lo que se confirma es lo que se mostró.
  const [inicial] = useState(vista);
  const [paso, setPaso] = useState<Paso>(inicial.porAsignar.length > 0 ? 'marcar' : 'cantidad');
  const [marcados, setMarcados] = useState<readonly string[]>([]);
  const [otra, setOtra] = useState(efectivoInicial !== undefined);
  const [real, setReal] = useState<Centavos | null>(efectivoInicial ?? null);
  const [calculo, setCalculo] = useState<CalculoArqueo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const esperado =
    inicial.saldo -
    inicial.porAsignar.filter((g) => marcados.includes(g.transaccionId)).reduce((s, g) => s + g.monto, 0);

  const entrada = (efectivoReal: Centavos) => ({
    cuentaId: inicial.cuentaId,
    efectivoReal,
    marcados,
  });

  const confirmar = (extra: Parameters<typeof confirmarArqueo>[1] | null, mensaje: string) => {
    setError(null);
    try {
      confirmarArqueo(ctx, extra ?? entrada(real ?? esperado));
      setHecho(mensaje);
      refrescar();
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };

  const calcular = (efectivoReal: Centavos) => {
    setError(null);
    try {
      const c = calcularArqueo(ctx, entrada(efectivoReal));
      if (c.accion === 'ninguna') {
        confirmar(entrada(efectivoReal), 'Listo: tu efectivo cuadra.');
        return;
      }
      setReal(efectivoReal);
      setCalculo(c);
      setPaso('resultado');
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };

  if (hecho) {
    return (
      <Tarjeta testID="arqueo-hecho">
        <Texto variante="cuerpoFuerte">{hecho}</Texto>
        <Boton etiqueta="Listo" alPresionar={alCerrar} testID="arqueo-listo" />
      </Tarjeta>
    );
  }

  return (
    <View style={{ gap: espacio.l }}>
      {paso === 'marcar' ? (
        <View style={{ gap: espacio.s }} testID="arqueo-paso-marcar">
          <Texto variante="subtitulo">Antes: ¿pagaste alguno de estos en efectivo?</Texto>
          <Texto variante="secundario" tono="secundario">
            Los que marques pasan a tu efectivo antes de contar, para no contarlos dos veces.
          </Texto>
          {inicial.porAsignar.map((g) => (
            <Casilla
              key={g.transaccionId}
              etiqueta={`${g.descripcion ?? 'Gasto'} ${formatearCentavos(g.monto)} · ${g.etiqueta}`}
              valor={marcados.includes(g.transaccionId)}
              alCambiar={(v) =>
                setMarcados((m) => (v ? [...m, g.transaccionId] : m.filter((id) => id !== g.transaccionId)))
              }
              testID={`arqueo-marcar-${g.transaccionId}`}
            />
          ))}
          <Boton etiqueta="Continuar" alPresionar={() => setPaso('cantidad')} testID="arqueo-continuar" />
        </View>
      ) : null}

      {paso === 'cantidad' ? (
        <View style={{ gap: espacio.s }} testID="arqueo-paso-cantidad">
          <Texto variante="subtitulo" testID="arqueo-esperado">
            {`Deberías traer ${formatearCentavos(esperado)} en efectivo. ¿Cuánto traes?`}
          </Texto>
          <GrupoChips
            opciones={[
              { valor: 'exacto', etiqueta: formatearCentavos(esperado) },
              { valor: 'otra', etiqueta: 'Otra cantidad' },
            ]}
            valor={otra ? 'otra' : null}
            alCambiar={(v) => (v === 'exacto' ? calcular(esperado) : setOtra(true))}
            prefijoTestID="arqueo"
          />
          {otra ? (
            <>
              <CampoMonto
                etiqueta="¿Cuánto traes?"
                valorInicial={real}
                alCambiar={setReal}
                autoFocus={efectivoInicial === undefined}
                testID="arqueo-monto"
              />
              <Boton
                etiqueta="Continuar"
                deshabilitado={real === null}
                alPresionar={() => real !== null && calcular(real)}
                testID="arqueo-calcular"
              />
            </>
          ) : null}
        </View>
      ) : null}

      {paso === 'resultado' && calculo ? (
        calculo.hueco > 0 ? (
          <Faltante
            calculo={calculo}
            alConfirmar={(propuesta) =>
              confirmar(
                { ...entrada(calculo.efectivoReal), propuesta },
                `Listo: tu efectivo quedó en ${formatearCentavos(calculo.efectivoReal)}.`,
              )
            }
          />
        ) : (
          <Sobrante
            calculo={calculo}
            alResponder={(sobrante) =>
              confirmar(
                { ...entrada(calculo.efectivoReal), sobrante },
                `Listo: tu efectivo quedó en ${formatearCentavos(calculo.efectivoReal)}.`,
              )
            }
          />
        )
      ) : null}

      {error ? (
        <Texto variante="secundario" tono="faltante" testID="arqueo-error">
          {error}
        </Texto>
      ) : null}
    </View>
  );
}

/** "Faltan $315. Lo repartí según tus gastos en efectivo:" con montos editables que deben sumar el faltante. */
function Faltante({
  calculo,
  alConfirmar,
}: {
  calculo: CalculoArqueo;
  alConfirmar: (propuesta: { categoria: string; monto: Centavos }[]) => void;
}) {
  const [montos, setMontos] = useState<(Centavos | null)[]>(() => calculo.propuesta.map((p) => p.monto));
  const [error, setError] = useState<string | null>(null);
  const suma = montos.reduce<number>((s, m) => s + (m ?? 0), 0);
  return (
    <View style={{ gap: espacio.s }} testID="arqueo-faltante">
      <Texto variante="subtitulo">
        {`Faltan ${formatearCentavos(calculo.hueco)}. Lo repartí según tus gastos en efectivo:`}
      </Texto>
      <Tarjeta>
        {calculo.propuesta.map((p, i) => (
          <CampoMonto
            key={p.categoria}
            etiqueta={p.nombre}
            valorInicial={p.monto}
            alCambiar={(m) => setMontos((xs) => xs.map((x, j) => (j === i ? m : x)))}
            testID={`arqueo-propuesta-${p.categoria}`}
          />
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Texto variante="cuerpoFuerte">Total</Texto>
          <Cifra centavos={suma} contexto="Total" testID="arqueo-propuesta-total" />
        </View>
      </Tarjeta>
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta="Confirmar"
        alPresionar={() => {
          if (suma !== calculo.hueco) {
            setError(
              `La suma debe ser ${formatearCentavos(calculo.hueco)}; ahora es ${formatearCentavos(suma)}.`,
            );
            return;
          }
          alConfirmar(
            calculo.propuesta
              .map((p, i) => ({ categoria: p.categoria, monto: montos[i] ?? 0 }))
              .filter((p) => p.monto > 0),
          );
        }}
        testID="arqueo-confirmar"
      />
    </View>
  );
}

type OpcionSobrante = RespuestaSobrante['tipo'];

/** "Traes $15 más de lo esperado. ¿De dónde salió?" (E7-09): nunca se registra sin respuesta. */
function Sobrante({
  calculo,
  alResponder,
}: {
  calculo: CalculoArqueo;
  alResponder: (r: RespuestaSobrante) => void;
}) {
  const teDeben = useVista((ctx) => listarCuentas(ctx).teDeben);
  const [opcion, setOpcion] = useState<OpcionSobrante | null>(null);
  return (
    <View style={{ gap: espacio.s }} testID="arqueo-sobrante">
      <Texto variante="subtitulo">
        {`Traes ${formatearCentavos(-calculo.hueco)} más de lo esperado. ¿De dónde salió?`}
      </Texto>
      <GrupoChips
        opciones={[
          { valor: 'me_dieron' as OpcionSobrante, etiqueta: 'Me dieron dinero' },
          ...(teDeben.length > 0
            ? [{ valor: 'me_pagaron' as OpcionSobrante, etiqueta: 'Me pagaron lo que me debían' }]
            : []),
          { valor: 'anote_de_mas' as OpcionSobrante, etiqueta: 'Anoté algo de más' },
          { valor: 'no_se' as OpcionSobrante, etiqueta: 'No sé (ajustar)' },
        ]}
        valor={opcion}
        alCambiar={(o) => {
          if (o === 'me_pagaron') setOpcion(o);
          else alResponder({ tipo: o } as RespuestaSobrante);
        }}
        prefijoTestID="arqueo-sobrante"
      />
      {opcion === 'me_pagaron' ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario">¿Quién te pagó?</Texto>
          <GrupoChips
            opciones={teDeben.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
            valor={null}
            alCambiar={(personaId) => alResponder({ tipo: 'me_pagaron', personaId })}
            prefijoTestID="arqueo-persona"
          />
        </View>
      ) : null}
    </View>
  );
}
