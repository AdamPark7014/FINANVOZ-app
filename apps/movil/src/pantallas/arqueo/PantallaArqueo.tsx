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
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, Cifra, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { Casilla, Chips } from '../onboarding/componentes';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { EstadoVacio } from '../principal/EstadoVacio';
import { mensajeError } from '../principal/textos';
import {
  ACCESIBILIDAD_CERRAR,
  ACCESIBILIDAD_LISTO,
  CERRAR,
  CONFIRMAR,
  CONTINUAR,
  PISTA_CALCULAR,
  PISTA_CERRAR,
  PISTA_CONFIRMAR,
  PISTA_CONTINUAR,
  PISTA_LISTO,
  PISTA_MONTO_TRAES,
  ETIQUETA_MONTO_TRAES,
  ETIQUETA_OTRA_CANTIDAD,
  ETIQUETA_QUIEN_TE_PAGO,
  LISTO,
  mensajeCuadra,
  mensajeEfectivoQuedo,
  mensajeSumaPropuesta,
  OPCIONES_SOBRANTE,
  ETIQUETA_GASTO_SIN_DESCRIPCION,
  etiquetaVacioSinEfectivo,
  PASO_MARCAR_AYUDA,
  PASO_MARCAR_TITULO,
  TEXTO_SIN_CUENTA_EFECTIVO,
  TITULO,
  textoDeberiasTraer,
  textoFaltante,
  textoSobrante,
  TOTAL,
} from './textos';

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
        <Texto testID="arqueo-titulo" variante="titulo" accessibilityRole="header">
          {TITULO}
        </Texto>
        <Boton
          etiqueta={CERRAR}
          etiquetaAccesible={ACCESIBILIDAD_CERRAR}
          pista={PISTA_CERRAR}
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
        <EstadoVacio
          texto={TEXTO_SIN_CUENTA_EFECTIVO}
          testID="arqueo-sin-efectivo"
          etiquetaAccesible={etiquetaVacioSinEfectivo()}
        />
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
  const registrarEvento = useAnalitica();
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
  const preguntaCantidad = textoDeberiasTraer(esperado);

  const entrada = (efectivoReal: Centavos) => ({
    cuentaId: inicial.cuentaId,
    efectivoReal,
    marcados,
  });

  const confirmar = (extra: Parameters<typeof confirmarArqueo>[1] | null, mensaje: string) => {
    setError(null);
    try {
      const { hueco } = confirmarArqueo(ctx, extra ?? entrada(real ?? esperado)).calculo;
      // Solo el tipo de resultado, nunca el monto (`03 §8`).
      registrarEvento({
        nombre: 'arqueo',
        propiedades: { resultado: hueco === 0 ? 'exacto' : hueco > 0 ? 'faltante' : 'sobrante' },
      });
      setHecho(mensaje);
      refrescar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const calcular = (efectivoReal: Centavos) => {
    setError(null);
    try {
      const c = calcularArqueo(ctx, entrada(efectivoReal));
      if (c.accion === 'ninguna') {
        confirmar(entrada(efectivoReal), mensajeCuadra());
        return;
      }
      setReal(efectivoReal);
      setCalculo(c);
      setPaso('resultado');
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (hecho) {
    return (
      <Tarjeta testID="arqueo-hecho">
        <Texto
          variante="cuerpoFuerte"
          testID="arqueo-mensaje-hecho"
          importantForAccessibility="yes"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {hecho}
        </Texto>
        <Boton
          etiqueta={LISTO}
          etiquetaAccesible={ACCESIBILIDAD_LISTO}
          pista={PISTA_LISTO}
          alPresionar={alCerrar}
          testID="arqueo-listo"
        />
      </Tarjeta>
    );
  }

  return (
    <View style={{ gap: espacio.l }}>
      {paso === 'marcar' ? (
        <View style={{ gap: espacio.s }} testID="arqueo-paso-marcar">
          <Texto variante="subtitulo">{PASO_MARCAR_TITULO}</Texto>
          <Texto variante="secundario" tono="secundario">
            {PASO_MARCAR_AYUDA}
          </Texto>
          {inicial.porAsignar.map((g) => (
            <Casilla
              key={g.transaccionId}
              etiqueta={`${g.descripcion ?? ETIQUETA_GASTO_SIN_DESCRIPCION} ${formatearCentavos(g.monto)} · ${g.etiqueta}`}
              valor={marcados.includes(g.transaccionId)}
              alCambiar={(v) =>
                setMarcados((m) => (v ? [...m, g.transaccionId] : m.filter((id) => id !== g.transaccionId)))
              }
              testID={`arqueo-marcar-${g.transaccionId}`}
            />
          ))}
          <Boton
            etiqueta={CONTINUAR}
            pista={PISTA_CONTINUAR}
            alPresionar={() => setPaso('cantidad')}
            testID="arqueo-continuar"
          />
        </View>
      ) : null}

      {paso === 'cantidad' ? (
        <View style={{ gap: espacio.s }} testID="arqueo-paso-cantidad">
          <Texto variante="subtitulo" testID="arqueo-esperado" {...OCULTAR_ETIQUETA_VISIBLE}>
            {preguntaCantidad}
          </Texto>
          <GrupoChips
            opciones={[
              { valor: 'exacto', etiqueta: formatearCentavos(esperado) },
              { valor: 'otra', etiqueta: ETIQUETA_OTRA_CANTIDAD },
            ]}
            valor={otra ? 'otra' : null}
            alCambiar={(v) => (v === 'exacto' ? calcular(esperado) : setOtra(true))}
            prefijoTestID="arqueo"
            etiqueta={preguntaCantidad}
          />
          {otra ? (
            <>
              <CampoMonto
                etiqueta={ETIQUETA_MONTO_TRAES}
                ayuda={PISTA_MONTO_TRAES}
                valorInicial={real}
                alCambiar={setReal}
                autoFocus={efectivoInicial === undefined}
                testID="arqueo-monto"
              />
              <Boton
                etiqueta={CONTINUAR}
                pista={PISTA_CALCULAR}
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
                mensajeEfectivoQuedo(calculo.efectivoReal),
              )
            }
          />
        ) : (
          <Sobrante
            calculo={calculo}
            alResponder={(sobrante) =>
              confirmar(
                { ...entrada(calculo.efectivoReal), sobrante },
                mensajeEfectivoQuedo(calculo.efectivoReal),
              )
            }
          />
        )
      ) : null}

      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="arqueo-error"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
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
        {textoFaltante(calculo.hueco)}
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
          <Texto variante="cuerpoFuerte">{TOTAL}</Texto>
          <Cifra centavos={suma} contexto={TOTAL} testID="arqueo-propuesta-total" />
        </View>
      </Tarjeta>
      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          testID="arqueo-error-propuesta"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={CONFIRMAR}
        pista={PISTA_CONFIRMAR}
        alPresionar={() => {
          if (suma !== calculo.hueco) {
            setError(mensajeSumaPropuesta(calculo.hueco, suma));
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
  const preguntaSobrante = textoSobrante(-calculo.hueco);
  return (
    <View style={{ gap: espacio.s }} testID="arqueo-sobrante">
      <Texto variante="subtitulo" {...OCULTAR_ETIQUETA_VISIBLE}>
        {preguntaSobrante}
      </Texto>
      <GrupoChips
        opciones={[
          { valor: 'me_dieron' as OpcionSobrante, etiqueta: OPCIONES_SOBRANTE.me_dieron },
          ...(teDeben.length > 0
            ? [{ valor: 'me_pagaron' as OpcionSobrante, etiqueta: OPCIONES_SOBRANTE.me_pagaron }]
            : []),
          { valor: 'anote_de_mas' as OpcionSobrante, etiqueta: OPCIONES_SOBRANTE.anote_de_mas },
          { valor: 'no_se' as OpcionSobrante, etiqueta: OPCIONES_SOBRANTE.no_se },
        ]}
        valor={opcion}
        alCambiar={(o) => {
          if (o === 'me_pagaron') setOpcion(o);
          else alResponder({ tipo: o } as RespuestaSobrante);
        }}
        prefijoTestID="arqueo-sobrante"
        etiqueta={preguntaSobrante}
      />
      {opcion === 'me_pagaron' ? (
        <Chips
          testID="arqueo-persona"
          etiqueta={ETIQUETA_QUIEN_TE_PAGO}
          opciones={teDeben.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
          valor={null}
          alCambiar={(personaId) => alResponder({ tipo: 'me_pagaron', personaId })}
        />
      ) : null}
    </View>
  );
}
