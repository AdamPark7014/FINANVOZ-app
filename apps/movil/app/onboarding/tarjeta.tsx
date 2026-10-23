import type { LecturaDe, LecturaPaso } from '@cartera/nlu';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MensajeError, PasoOnboarding, pasoVisibleOnb } from '../../src/pantallas/onboarding/componentes';
import { DecirloPaso, type PropuestaDecirlo } from '../../src/pantallas/onboarding/DecirloPaso';
import {
  entradaTarjeta,
  faltantesTarjeta,
  filasTarjeta,
  pendientesTarjeta,
  prellenadoTarjeta,
  tomarTarjetaDicha,
} from '../../src/pantallas/onboarding/decirlo';
import {
  BTN_CAMBIAR_ALGO,
  BTN_SI_SEGUIR,
  btnSiAgrega,
  PISTA_TARJETA_DESPUES_ONB,
  PISTA_TARJETA_GUARDAR_ONB,
  textoEscribeAbajo,
  textoMeFalta,
  tituloEntendiAgrego,
} from '../../src/pantallas/onboarding/textos';
import { useFormularioTarjeta } from '../../src/pantallas/tarjetas/FormularioTarjetaNueva';
import { agregarTarjetaCredito } from '../../src/servicios';
import { contextoPasoOnboarding } from '../../src/servicios/onboarding';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, etiquetaHablada, Texto } from '../../src/ui';

type LecturaTarjeta = LecturaDe<'tarjeta'>;

/**
 * O4 · Tarjeta de crédito completa (`02 §3.1`): ciclo, límite, modo, saldo obligatorio, meses que ya tenías y
 * "¿El saldo ya los incluye?". Sin saldo no se crea ("Agregar después"). El formulario es el mismo de
 * Cuentas → "Agregar tarjeta". «Dímelo» (aquí o desde O4) llena el formulario con todo lo dicho (nombre, ciclo,
 * últimos 4, saldo, modo y límite) y dice qué falta escribir; si se dijo todo, «Sí» la agrega sin formulario.
 */
export default function TarjetaCredito() {
  // Lo dicho en O4 llega una sola vez; después, cada «Dímelo» de aquí vuelve a montar el formulario con lo nuevo.
  const [lectura, setLectura] = useState<LecturaTarjeta | null>(() => tomarTarjetaDicha());
  const [version, setVersion] = useState(0);
  return (
    <FormularioTarjetaOnb
      key={version}
      lectura={lectura}
      alLlenar={(l) => {
        setLectura(l);
        setVersion((v) => v + 1);
      }}
    />
  );
}

function FormularioTarjetaOnb({
  lectura,
  alLlenar,
}: {
  lectura: LecturaTarjeta | null;
  alLlenar: (l: LecturaTarjeta) => void;
}) {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const contexto = useVista(contextoPasoOnboarding);
  const { campos, guardar, error } = useFormularioTarjeta({
    prellenado: lectura ? prellenadoTarjeta(lectura) : null,
    alGuardar: () => router.back(),
    errorAparte: true,
  });

  const proponer = (l: LecturaPaso): PropuestaDecirlo | null => {
    if (l.paso !== 'tarjeta') return null;
    const entrada = entradaTarjeta(l);
    return {
      titulo: tituloEntendiAgrego(1, 'f'),
      filas: filasTarjeta(l),
      ...(entrada ? {} : { efecto: textoMeFalta(faltantesTarjeta(l)) }),
      confirmar: entrada
        ? {
            etiqueta: btnSiAgrega(1, 'f'),
            accion: () => {
              agregarTarjetaCredito(ctx, entrada);
              refrescar();
              router.back();
            },
          }
        : { etiqueta: BTN_SI_SEGUIR, accion: () => alLlenar(l) },
      cambiar: { etiqueta: BTN_CAMBIAR_ALGO, accion: () => alLlenar(l) },
    };
  };

  return (
    <PasoOnboarding
      testID="onb-tarjeta"
      paso={pasoVisibleOnb(4)}
      titulo="Tarjeta de crédito"
      pie={
        <>
          <MensajeError texto={error} />
          <Boton
            testID="tarjeta-guardar"
            etiqueta="Guardar tarjeta"
            pista={PISTA_TARJETA_GUARDAR_ONB}
            alPresionar={guardar}
          />
          <Boton
            testID="tarjeta-despues"
            variante="texto"
            etiqueta="Agregar después"
            pista={PISTA_TARJETA_DESPUES_ONB}
            alPresionar={() => router.back()}
          />
        </>
      }
    >
      <DecirloPaso
        testID="onb-tarjeta-decir"
        pasos={['tarjeta']}
        ejemplo="tengo una Nu que corta el 28 y pago el 18"
        correccion="no, corta el 25"
        contexto={contexto}
        proponer={proponer}
      />
      {lectura && pendientesTarjeta(lectura).length > 0 ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID="onb-tarjeta-pendiente"
          accessibilityLiveRegion="polite"
          accessibilityLabel={etiquetaHablada(textoEscribeAbajo(pendientesTarjeta(lectura)))}
        >
          {textoEscribeAbajo(pendientesTarjeta(lectura))}
        </Texto>
      ) : null}
      {campos}
    </PasoOnboarding>
  );
}
