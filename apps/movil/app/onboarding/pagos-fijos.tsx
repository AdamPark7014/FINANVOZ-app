import type { Centavos, PlainDate, Regla } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Casilla,
  Chips,
  ERROR_GUARDAR,
  MensajeError,
  OMITIR_CAPTURA_ONB,
  PasoOnboarding,
  type OpcionChip,
} from '../../src/pantallas/onboarding/componentes';
import { OPCIONES_DIA_SEMANA } from '../../src/pantallas/onboarding/ingreso';
import {
  capitalizar,
  describirRegla,
  hastaDePago,
  leerPagosRestantes,
  limpiarNombrePago,
  OPCIONES_FRECUENCIA_PAGO,
  OPCIONES_MES,
  reglaDePago,
  RESPUESTAS_PAGO_INICIALES,
  totalMensual,
  type RespuestasPago,
} from '../../src/pantallas/onboarding/pagos-fijos';
import {
  AYUDA_PAGO_RESTANTES,
  AYUDA_PAGO_VARIABLE,
  AYUDA_PAGOS_FIJOS,
  BTN_ONB_CONTINUAR,
  BTN_ONB_SALTAR,
  BTN_PAGO_MAS_OPCIONES,
  BTN_PAGO_MENOS_OPCIONES,
  BTN_PAGO_QUITAR,
  CASILLA_PAGO_VARIABLE,
  CHIP_PAGO_CUENTA_DESPUES,
  CHIP_PAGO_OTRO,
  EJEMPLO_PAGO_NOMBRE,
  ERROR_PAGO_FIJO_INCOMPLETO,
  ERROR_PAGO_NOMBRE,
  ERROR_PAGO_RESTANTES,
  ETIQUETA_PAGO_CUENTA,
  ETIQUETA_PAGO_DIA_MES,
  ETIQUETA_PAGO_DIA_SEMANA,
  ETIQUETA_PAGO_FRECUENCIA,
  ETIQUETA_PAGO_MES,
  ETIQUETA_PAGO_MONTO_FIJO,
  ETIQUETA_PAGO_MONTO_VARIABLE,
  ETIQUETA_PAGO_NOMBRE,
  ETIQUETA_PAGO_RESTANTES,
  etiquetaAgregarPago,
  etiquetaFilaPago,
  etiquetaPagosSuman,
  PISTA_PAGO_MAS_OPCIONES,
  PISTA_PAGO_MENOS_OPCIONES,
  PISTA_PAGOS_CONTINUAR,
  PISTA_PAGOS_SALTAR,
  pistaQuitarPago,
  TEXTO_PAGOS_SUMAN,
  TIP_PAGOS_SALTAR,
  TITULO_PAGOS_FIJOS,
} from '../../src/pantallas/onboarding/textos';
import {
  agregarPagoFijo,
  etiquetaFecha,
  listarCuentas,
  PAGOS_FIJOS_SUGERIDOS,
  quitarPagoFijo,
} from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import {
  Boton,
  CampoMonto,
  CampoTexto,
  Cifra,
  cifraEnPalabras,
  espacio,
  etiquetaHablada,
  Tarjeta,
  Texto,
} from '../../src/ui';

type Clave = (typeof PAGOS_FIJOS_SUGERIDOS)[number]['clave'] | 'otro';

const CHIPS: readonly OpcionChip<Clave>[] = [
  ...PAGOS_FIJOS_SUGERIDOS.map((p) => ({ valor: p.clave as Clave, etiqueta: capitalizar(p.concepto) })),
  { valor: 'otro', etiqueta: CHIP_PAGO_OTRO },
];

const CUENTA_DESPUES = 'despues';

interface PagoAgregado {
  id: string;
  concepto: string;
  monto: Centavos;
  regla: Regla;
  cuenta: string | null;
  hasta: PlainDate | null;
}

/**
 * O5 · Pagos fijos (`02 §3`): chips sugeridos u «Otro» → nombre, cada cuándo, monto, si cambia cada vez y, bajo
 * «Más opciones», de qué cuenta sale y cuántos pagos faltan. La lista deja quitar y dice cuánto suman al mes.
 */
export default function PagosFijos() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const cuentas = useVista(listarCuentas);
  const [clave, setClave] = useState<Clave | null>(null);
  const [nombre, setNombre] = useState('');
  const [respuestas, setRespuestas] = useState<RespuestasPago>(RESPUESTAS_PAGO_INICIALES);
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [variable, setVariable] = useState(false);
  const [masOpciones, setMasOpciones] = useState(false);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [agregados, setAgregados] = useState<PagoAgregado[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Cambia con cada chip y cada alta: así los campos no controlados (monto) vuelven a empezar vacíos.
  const [formulario, setFormulario] = useState(0);
  const sugerido = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === clave) ?? null;

  const opcionesCuenta: readonly OpcionChip<string>[] = [
    { valor: CUENTA_DESPUES, etiqueta: CHIP_PAGO_CUENTA_DESPUES },
    ...cuentas.tienes.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
    ...cuentas.debes.filter((d) => d.tipo === 'tarjeta').map((d) => ({ valor: d.id, etiqueta: d.nombre })),
  ];

  const reiniciar = (siguiente: Clave | null) => {
    const s = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === siguiente) ?? null;
    setClave(siguiente);
    setNombre(s ? capitalizar(s.concepto) : '');
    setVariable(s?.variable ?? false);
    setRespuestas(RESPUESTAS_PAGO_INICIALES);
    setMonto(null);
    setCuentaId(null);
    setMasOpciones(false);
    setError(null);
    setFormulario((n) => n + 1);
  };

  const agregar = () => {
    if (clave === null) return;
    const concepto = limpiarNombrePago(nombre);
    if (!concepto) {
      setError(ERROR_PAGO_NOMBRE);
      return;
    }
    const regla = reglaDePago(respuestas);
    if (monto === null || monto <= 0 || regla === null) {
      setError(ERROR_PAGO_FIJO_INCOMPLETO);
      return;
    }
    const restantes = leerPagosRestantes(respuestas.pagosRestantes);
    if (restantes === undefined) {
      setError(ERROR_PAGO_RESTANTES);
      return;
    }
    const hasta = restantes === null ? null : hastaDePago(regla, ctx.reloj.hoy(), restantes);
    // Si la persona dejó el nombre del chip tal cual, se guarda el concepto del catálogo (minúsculas, como
    // antes: «¿Ya pagaste la luz?»); si lo cambió («Netflix»), se guarda como lo escribió.
    const conceptoGuardado =
      sugerido && concepto === capitalizar(sugerido.concepto) ? sugerido.concepto : concepto;
    let id: string;
    try {
      id = agregarPagoFijo(ctx, {
        concepto: conceptoGuardado,
        monto,
        regla,
        categoria: sugerido?.categoria ?? null,
        cuentaId,
        variable,
        hasta,
      });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    const cuenta = cuentaId ? (opcionesCuenta.find((o) => o.valor === cuentaId)?.etiqueta ?? null) : null;
    setAgregados((a) => [...a, { id, concepto, monto, regla, cuenta, hasta }]);
    reiniciar(null);
    refrescar();
  };

  const quitar = (p: PagoAgregado) => {
    try {
      quitarPagoFijo(ctx, p.id);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setAgregados((a) => a.filter((x) => x.id !== p.id));
    setError(null);
    refrescar();
  };

  const total = totalMensual(agregados);
  const pideDiaMes = respuestas.frecuencia === 'mensual' || respuestas.frecuencia === 'anual';
  const etiquetaAgregar = etiquetaAgregarPago(limpiarNombrePago(nombre) ?? sugerido?.concepto ?? 'pago');

  return (
    <PasoOnboarding
      testID="onb-pagos-fijos"
      paso={5}
      titulo={TITULO_PAGOS_FIJOS}
      ayuda={AYUDA_PAGOS_FIJOS}
      tip={TIP_PAGOS_SALTAR}
      pie={
        <Boton
          testID="onb-pagos-continuar"
          etiqueta={agregados.length > 0 ? BTN_ONB_CONTINUAR : BTN_ONB_SALTAR}
          variante={agregados.length > 0 ? 'primario' : 'secundario'}
          pista={agregados.length > 0 ? PISTA_PAGOS_CONTINUAR : PISTA_PAGOS_SALTAR}
          alPresionar={() => router.push(OMITIR_CAPTURA_ONB ? '/onboarding/colchon' : '/onboarding/captura')}
        />
      }
    >
      <Chips testID="onb-pago" opciones={CHIPS} valor={clave} alCambiar={reiniciar} />
      {clave !== null ? (
        <Tarjeta key={`${clave}-${formulario}`} testID="onb-pago-formulario">
          <CampoTexto
            testID="onb-pago-nombre"
            etiqueta={ETIQUETA_PAGO_NOMBRE}
            ejemplo={EJEMPLO_PAGO_NOMBRE}
            valor={nombre}
            alCambiar={setNombre}
            autoFocus={clave === 'otro'}
          />
          <Chips
            testID="onb-pago-frecuencia"
            etiqueta={ETIQUETA_PAGO_FRECUENCIA}
            opciones={OPCIONES_FRECUENCIA_PAGO}
            valor={respuestas.frecuencia}
            alCambiar={(frecuencia) => setRespuestas((r) => ({ ...r, frecuencia }))}
          />
          {respuestas.frecuencia === 'semanal' ? (
            <Chips
              testID="onb-pago-dia-semana"
              etiqueta={ETIQUETA_PAGO_DIA_SEMANA}
              opciones={OPCIONES_DIA_SEMANA}
              valor={respuestas.diaSemana}
              alCambiar={(diaSemana) => setRespuestas((r) => ({ ...r, diaSemana }))}
            />
          ) : null}
          {respuestas.frecuencia === 'anual' ? (
            <Chips
              testID="onb-pago-mes"
              etiqueta={ETIQUETA_PAGO_MES}
              opciones={OPCIONES_MES}
              valor={respuestas.mes}
              alCambiar={(mes) => setRespuestas((r) => ({ ...r, mes }))}
            />
          ) : null}
          {pideDiaMes ? (
            <CampoTexto
              testID="onb-pago-dia"
              etiqueta={ETIQUETA_PAGO_DIA_MES}
              ejemplo="5"
              teclado="number-pad"
              valor={respuestas.diaMes}
              alCambiar={(diaMes) => setRespuestas((r) => ({ ...r, diaMes }))}
            />
          ) : null}
          <CampoMonto
            testID="onb-pago-monto"
            etiqueta={variable ? ETIQUETA_PAGO_MONTO_VARIABLE : ETIQUETA_PAGO_MONTO_FIJO}
            {...(variable ? { ayuda: AYUDA_PAGO_VARIABLE } : {})}
            alCambiar={setMonto}
          />
          <Casilla
            testID="onb-pago-variable"
            etiqueta={CASILLA_PAGO_VARIABLE}
            valor={variable}
            alCambiar={setVariable}
          />
          <Boton
            testID="onb-pago-mas-opciones"
            variante="secundario"
            ancho="contenido"
            etiqueta={masOpciones ? BTN_PAGO_MENOS_OPCIONES : BTN_PAGO_MAS_OPCIONES}
            pista={masOpciones ? PISTA_PAGO_MENOS_OPCIONES : PISTA_PAGO_MAS_OPCIONES}
            alPresionar={() => setMasOpciones((v) => !v)}
          />
          {masOpciones ? (
            <>
              <Chips
                testID="onb-pago-cuenta"
                etiqueta={ETIQUETA_PAGO_CUENTA}
                opciones={opcionesCuenta}
                valor={cuentaId ?? CUENTA_DESPUES}
                alCambiar={(v) => setCuentaId(v === CUENTA_DESPUES ? null : v)}
              />
              <CampoTexto
                testID="onb-pago-restantes"
                etiqueta={ETIQUETA_PAGO_RESTANTES}
                ayuda={AYUDA_PAGO_RESTANTES}
                ejemplo="12"
                teclado="number-pad"
                valor={respuestas.pagosRestantes}
                alCambiar={(pagosRestantes) => setRespuestas((r) => ({ ...r, pagosRestantes }))}
              />
            </>
          ) : null}
          <Boton testID="onb-pago-agregar" etiqueta={etiquetaAgregar} alPresionar={agregar} />
        </Tarjeta>
      ) : null}
      {agregados.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="onb-pagos-lista">
          {agregados.map((p) => {
            const regla = describirRegla(p.regla);
            const fin = p.hasta ? etiquetaFecha(p.hasta) : null;
            const detalle = [regla, p.cuenta ? `sale de ${p.cuenta}` : null, fin ? `hasta ${fin}` : null]
              .filter((x): x is string => x !== null)
              .join(' · ');
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                <View
                  testID={`onb-pago-agregado-${p.id}`}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={etiquetaHablada(
                    etiquetaFilaPago({
                      concepto: p.concepto,
                      regla,
                      montoEnPalabras: cifraEnPalabras(p.monto),
                      cuenta: p.cuenta,
                      fin,
                    }),
                  )}
                  style={{ flex: 1, gap: espacio.xs }}
                >
                  <View
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                  >
                    <Texto variante="cuerpo">{p.concepto}</Texto>
                    <Cifra centavos={p.monto} contexto={`${p.concepto}, ${regla}`} />
                  </View>
                  <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Texto variante="secundario">{detalle}</Texto>
                  </View>
                </View>
                <Boton
                  testID={`onb-pago-quitar-${p.id}`}
                  variante="secundario"
                  ancho="contenido"
                  etiqueta={BTN_PAGO_QUITAR}
                  pista={pistaQuitarPago(p.concepto)}
                  alPresionar={() => quitar(p)}
                />
              </View>
            );
          })}
          <View
            testID="onb-pagos-total"
            accessible
            accessibilityRole="text"
            accessibilityLabel={etiquetaHablada(etiquetaPagosSuman(cifraEnPalabras(total)))}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Texto variante="etiqueta">{TEXTO_PAGOS_SUMAN}</Texto>
              <Cifra centavos={total} contexto={TEXTO_PAGOS_SUMAN} />
            </View>
          </View>
        </View>
      ) : null}
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
