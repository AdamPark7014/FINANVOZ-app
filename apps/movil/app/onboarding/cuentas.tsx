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
  AYUDA_EFECTIVO_ONB,
  BTN_AGREGAR_CUENTA_ONB,
  BTN_AGREGAR_DEBITO_BILLETERA,
  BTN_AGREGAR_TARJETA_CREDITO,
  BTN_ONB_CANCELAR,
  BTN_ONB_CONTINUAR,
  EJEMPLO_NOMBRE_BILLETERA,
  EJEMPLO_NOMBRE_DEBITO,
  ERROR_CUENTA_INCOMPLETA,
  ETIQUETA_CUENTA_GENERICA,
  ETIQUETA_CHIP_AHORRO,
  ETIQUETA_CHIP_BILLETERA,
  ETIQUETA_CHIP_DEBITO,
  ETIQUETA_EFECTIVO_ONB,
  ETIQUETA_NOMBRE_CUENTA,
  ETIQUETA_SALDO_CUENTA_ONB,
  ETIQUETA_TARJETA_DEBES,
  ETIQUETAS_SUBTIPO_CUENTA,
  PISTA_AGREGAR_TARJETA_ONB,
  PISTA_CUENTAS_CONTINUAR,
  SUFIJO_TIENES,
  TIP_CUENTAS_MINIMO,
  TITULO_CUENTAS,
} from '../../src/pantallas/onboarding/textos';
import { agregarCuenta, agregarEfectivo, listarCuentas } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Cifra, espacio, Tarjeta, Texto } from '../../src/ui';

type TipoCuenta = 'debito' | 'billetera' | 'ahorro';

const OPCIONES_TIPO: readonly { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: ETIQUETA_CHIP_DEBITO },
  { valor: 'billetera', etiqueta: ETIQUETA_CHIP_BILLETERA },
  { valor: 'ahorro', etiqueta: ETIQUETA_CHIP_AHORRO },
];

/**
 * O4 · Cuentas (`02 §3`): el efectivo es el mínimo; débito, billeteras y tarjetas de crédito (§3.1) son
 * opcionales. Cada saldo se guarda como saldo inicial en servicios.
 */
export default function Cuentas() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const vista = useVista(listarCuentas);
  const tieneEfectivo = vista.tienes.some((c) => c.subtipo === 'efectivo');
  const tarjetas = vista.debes.filter((d) => d.tipo === 'tarjeta');

  const [efectivo, setEfectivo] = useState<Centavos | null>(null);
  const [formulario, setFormulario] = useState(false);
  const [tipo, setTipo] = useState<TipoCuenta>('debito');
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState<Centavos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agregar = () => {
    if (nombre.trim() === '' || saldo === null) {
      setError(ERROR_CUENTA_INCOMPLETA);
      return;
    }
    try {
      agregarCuenta(ctx, { subtipo: tipo, nombre: nombre.trim(), saldo });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setError(null);
    setNombre('');
    setSaldo(null);
    setFormulario(false);
    refrescar();
  };

  const continuar = () => {
    try {
      // Sin cifra, el efectivo empieza en $0: contar de menos lo que tienes nunca infla tu día.
      if (!tieneEfectivo) agregarEfectivo(ctx, efectivo ?? 0);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    router.push('/onboarding/pagos-fijos');
  };

  return (
    <PasoOnboarding
      testID="onb-cuentas"
      paso={4}
      titulo={TITULO_CUENTAS}
      tip={TIP_CUENTAS_MINIMO}
      pie={
        <Boton
          testID="onb-cuentas-continuar"
          etiqueta={BTN_ONB_CONTINUAR}
          pista={PISTA_CUENTAS_CONTINUAR}
          alPresionar={continuar}
        />
      }
    >
      {tieneEfectivo ? null : (
        <CampoMonto
          testID="onb-efectivo"
          etiqueta={ETIQUETA_EFECTIVO_ONB}
          ayuda={AYUDA_EFECTIVO_ONB}
          alCambiar={setEfectivo}
        />
      )}

      {vista.tienes.length + tarjetas.length > 0 ? (
        <View style={{ gap: espacio.s }} testID="onb-cuentas-lista">
          {vista.tienes.map((c) => (
            <Tarjeta key={c.id}>
              <Texto variante="cuerpoFuerte">{c.nombre}</Texto>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto variante="secundario" tono="secundario">
                  {`${ETIQUETAS_SUBTIPO_CUENTA[c.subtipo] ?? ETIQUETA_CUENTA_GENERICA}${SUFIJO_TIENES}`}
                </Texto>
                <Cifra centavos={c.saldo} contexto={`En ${c.nombre} tienes`} />
              </View>
            </Tarjeta>
          ))}
          {tarjetas.map((t) => (
            <Tarjeta key={t.id}>
              <Texto variante="cuerpoFuerte">{t.nombre}</Texto>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Texto variante="secundario" tono="secundario">
                  {ETIQUETA_TARJETA_DEBES}
                </Texto>
                <Cifra centavos={t.saldo + t.meses} contexto={`En ${t.nombre} debes`} />
              </View>
            </Tarjeta>
          ))}
        </View>
      ) : null}

      {formulario ? (
        <Tarjeta testID="onb-cuenta-formulario">
          <Chips testID="onb-cuenta-tipo" opciones={OPCIONES_TIPO} valor={tipo} alCambiar={setTipo} />
          <CampoTexto
            testID="onb-cuenta-nombre"
            etiqueta={ETIQUETA_NOMBRE_CUENTA}
            ejemplo={tipo === 'billetera' ? EJEMPLO_NOMBRE_BILLETERA : EJEMPLO_NOMBRE_DEBITO}
            valor={nombre}
            alCambiar={setNombre}
          />
          <CampoMonto testID="onb-cuenta-saldo" etiqueta={ETIQUETA_SALDO_CUENTA_ONB} alCambiar={setSaldo} />
          <Boton testID="onb-cuenta-agregar" etiqueta={BTN_AGREGAR_CUENTA_ONB} alPresionar={agregar} />
          <Boton
            variante="texto"
            etiqueta={BTN_ONB_CANCELAR}
            alPresionar={() => {
              setFormulario(false);
              setError(null);
            }}
          />
        </Tarjeta>
      ) : (
        <Boton
          testID="onb-agregar-cuenta"
          variante="secundario"
          etiqueta={BTN_AGREGAR_DEBITO_BILLETERA}
          alPresionar={() => setFormulario(true)}
        />
      )}
      <Boton
        testID="onb-agregar-tarjeta"
        variante="secundario"
        etiqueta={BTN_AGREGAR_TARJETA_CREDITO}
        pista={PISTA_AGREGAR_TARJETA_ONB}
        alPresionar={() => router.push('/onboarding/tarjeta')}
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
