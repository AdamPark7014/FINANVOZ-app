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
import { agregarCuenta, agregarEfectivo, listarCuentas } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Cifra, espacio, Tarjeta, Texto } from '../../src/ui';

type TipoCuenta = 'debito' | 'billetera' | 'ahorro';

const OPCIONES_TIPO: readonly { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: 'Débito' },
  { valor: 'billetera', etiqueta: 'Billetera' },
  { valor: 'ahorro', etiqueta: 'Ahorro' },
];

const ETIQUETA_TIPO: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  billetera: 'Billetera',
  ahorro: 'Ahorro',
};

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
      setError('Escribe el nombre y el saldo de la cuenta.');
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
      titulo="¿Con qué pagas?"
      pie={<Boton testID="onb-cuentas-continuar" etiqueta="Continuar" alPresionar={continuar} />}
    >
      {tieneEfectivo ? null : (
        <CampoMonto
          testID="onb-efectivo"
          etiqueta="¿Cuánto efectivo traes ahorita?"
          ayuda="Si no sabes exacto, pon lo que calcules. Lo ajustas después."
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
                  {`${ETIQUETA_TIPO[c.subtipo] ?? 'Cuenta'} · tienes`}
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
                  Tarjeta de crédito · debes
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
            etiqueta="Nombre"
            ejemplo={tipo === 'billetera' ? 'Mercado Pago' : 'BBVA'}
            valor={nombre}
            alCambiar={setNombre}
          />
          <CampoMonto testID="onb-cuenta-saldo" etiqueta="¿Cuánto tienes hoy?" alCambiar={setSaldo} />
          <Boton testID="onb-cuenta-agregar" etiqueta="Agregar cuenta" alPresionar={agregar} />
          <Boton
            variante="texto"
            etiqueta="Cancelar"
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
          etiqueta="Agregar débito o billetera"
          alPresionar={() => setFormulario(true)}
        />
      )}
      <Boton
        testID="onb-agregar-tarjeta"
        variante="secundario"
        etiqueta="Agregar tarjeta de crédito"
        alPresionar={() => router.push('/onboarding/tarjeta')}
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
