import type { Centavos } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Chips,
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
} from '../../src/pantallas/onboarding/componentes';
import {
  AYUDA_PAGO_VARIABLE,
  AYUDA_PAGOS_FIJOS,
  BTN_ONB_CONTINUAR,
  BTN_ONB_SALTAR,
  ERROR_PAGO_FIJO_INCOMPLETO,
  ETIQUETA_PAGO_DIA_MES,
  ETIQUETA_PAGO_MONTO_FIJO,
  ETIQUETA_PAGO_MONTO_VARIABLE,
  etiquetaAgregarPago,
  PISTA_PAGOS_CONTINUAR,
  PISTA_PAGOS_SALTAR,
  TIP_PAGOS_SALTAR,
  TITULO_PAGOS_FIJOS,
} from '../../src/pantallas/onboarding/textos';
import { leerDiaMes } from '../../src/pantallas/onboarding/ingreso';
import { agregarPagoFijo, PAGOS_FIJOS_SUGERIDOS } from '../../src/servicios';
import { useSesion } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Cifra, espacio, Tarjeta, Texto } from '../../src/ui';

type Clave = (typeof PAGOS_FIJOS_SUGERIDOS)[number]['clave'];

const CHIPS = PAGOS_FIJOS_SUGERIDOS.map((p) => ({
  valor: p.clave,
  etiqueta: p.concepto.charAt(0).toUpperCase() + p.concepto.slice(1),
}));

interface PagoAgregado {
  id: string;
  concepto: string;
  monto: Centavos;
  dia: number;
}

/** O5 · Pagos fijos (`02 §3`): chips sugeridos → monto y día. Luz y agua son de monto variable. */
export default function PagosFijos() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const [clave, setClave] = useState<Clave | null>(null);
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [dia, setDia] = useState('');
  const [agregados, setAgregados] = useState<PagoAgregado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sugerido = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === clave) ?? null;

  const agregar = () => {
    if (!sugerido) return;
    const diaMes = leerDiaMes(dia);
    if (monto === null || monto <= 0 || diaMes === null) {
      setError(ERROR_PAGO_FIJO_INCOMPLETO);
      return;
    }
    let id: string;
    try {
      id = agregarPagoFijo(ctx, {
        concepto: sugerido.concepto,
        monto,
        regla: { tipo: 'mensual', dia: diaMes },
        categoria: sugerido.categoria,
        variable: sugerido.variable,
      });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setAgregados((a) => [
      ...a,
      { id, concepto: CHIPS.find((c) => c.valor === sugerido.clave)?.etiqueta ?? '', monto, dia: diaMes },
    ]);
    setClave(null);
    setMonto(null);
    setDia('');
    setError(null);
    refrescar();
  };

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
          alPresionar={() => router.push('/onboarding/captura')}
        />
      }
    >
      <Chips
        testID="onb-pago"
        opciones={CHIPS}
        valor={clave}
        alCambiar={(c) => {
          setClave(c);
          setMonto(null);
          setDia('');
          setError(null);
        }}
      />
      {sugerido ? (
        // `key`: al cambiar de chip, el campo de monto empieza vacío.
        <Tarjeta key={sugerido.clave} testID="onb-pago-formulario">
          <CampoMonto
            testID="onb-pago-monto"
            etiqueta={sugerido.variable ? ETIQUETA_PAGO_MONTO_VARIABLE : ETIQUETA_PAGO_MONTO_FIJO}
            {...(sugerido.variable ? { ayuda: AYUDA_PAGO_VARIABLE } : {})}
            alCambiar={setMonto}
          />
          <CampoTexto
            testID="onb-pago-dia"
            etiqueta={ETIQUETA_PAGO_DIA_MES}
            ejemplo="5"
            teclado="number-pad"
            valor={dia}
            alCambiar={setDia}
          />
          <Boton
            testID="onb-pago-agregar"
            etiqueta={etiquetaAgregarPago(sugerido.concepto)}
            alPresionar={agregar}
          />
        </Tarjeta>
      ) : null}
      {agregados.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="onb-pagos-lista">
          {agregados.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Texto variante="cuerpo">{`${p.concepto} · día ${p.dia}`}</Texto>
              <Cifra centavos={p.monto} contexto={`${p.concepto}, cada mes`} />
            </View>
          ))}
        </View>
      ) : null}
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
