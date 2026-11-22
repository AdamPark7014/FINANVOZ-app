import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import { corregirSaldoCuenta, detalleCuentaPropia } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Boton,
  CampoMonto,
  Cifra,
  coloresCuenta,
  espacio,
  EstadoVacio,
  Icono,
  Pantalla,
  radio,
  sombra,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { etiquetaContarEnCuenta, TITULO as TITULO_CONTAR_EFECTIVO } from '../arqueo/textos';
import { conAnuncio, Encabezado, MensajeEnLinea } from './Encabezado';
import {
  AYUDA_SALDO_REAL,
  BTN_CANCELAR,
  BTN_CORREGIR_SALDO,
  BTN_GUARDAR_SALDO,
  BTN_VER_MOVIMIENTOS,
  confirmacionSaldo,
  ERROR_GUARDAR,
  ERROR_SALDO_REAL,
  ETIQUETA_SALDO_REAL,
  ETIQUETA_TIENES,
  etiquetaTerminacion,
  etiquetaTerminacionHablada,
  MENSAJE_SALDO_IGUAL,
  PISTA_CORREGIR_SALDO,
  PISTA_GUARDAR_SALDO,
  PISTA_VER_MOVIMIENTOS_CUENTA,
  SUBTITULO_DETALLE,
  TEXTO_CUENTA_NO_ENCONTRADA,
  TEXTO_EFECTIVO_SE_CUENTA,
} from './textos';

/**
 * Detalle de una cuenta de Tienes (`02 §11`): saldo, «Corregir saldo» (débito, billetera y ahorro: una
 * conciliación, `04 §4` caso 22) o «Contar mi efectivo» (arqueo, `02 §7`) y «Ver movimientos» de esa cuenta.
 */
export function PantallaDetalleCuenta({
  cuentaId,
  alVolver,
  alVerMovimientos,
  alContarEfectivo,
}: {
  cuentaId: string;
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
  alVerMovimientos: (cuentaId: string) => void;
  alContarEfectivo?: (cuentaId: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const c = useVista((x) => detalleCuentaPropia(x, cuentaId));
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [saldoReal, setSaldoReal] = useState<Centavos | null>(null);
  const [mensaje, setMensajeBase] = useState<{ texto: string; error: boolean } | null>(null);
  const avisar = (texto: string, error: boolean) =>
    conAnuncio((t) => setMensajeBase(t ? { texto: t, error } : null))(texto);

  if (!c) {
    return (
      <Pantalla
        testID="cuenta-detalle"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <Encabezado titulo={ETIQUETA_TIENES} {...(alVolver ? { alVolver } : {})} testID="cuenta-detalle" />
        <EstadoVacio texto={TEXTO_CUENTA_NO_ENCONTRADA} testID="cuenta-detalle-no-encontrada" />
      </Pantalla>
    );
  }

  const guardarSaldo = () => {
    if (saldoReal === null) {
      avisar(ERROR_SALDO_REAL, true);
      return;
    }
    try {
      const r = corregirSaldoCuenta(ctx, c.id, saldoReal);
      setCorrigiendo(false);
      setSaldoReal(null);
      avisar(r.transaccionId ? confirmacionSaldo(c.nombre, r.saldo) : MENSAJE_SALDO_IGUAL, false);
      refrescar();
    } catch {
      avisar(ERROR_GUARDAR, true);
    }
  };

  const subtitulo = [
    SUBTITULO_DETALLE[c.subtipo] ?? null,
    c.ultimos4 ? etiquetaTerminacion(c.ultimos4) : null,
  ].filter((x): x is string => x !== null);

  return (
    <Pantalla
      testID="cuenta-detalle"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      <Encabezado titulo={c.nombre} {...(alVolver ? { alVolver } : {})} testID="cuenta-detalle">
        {subtitulo.length > 0 ? (
          <Texto
            variante="secundario"
            tono="secundario"
            testID="cuenta-detalle-subtitulo"
            accessibilityLabel={[
              SUBTITULO_DETALLE[c.subtipo] ?? '',
              c.ultimos4 ? etiquetaTerminacionHablada(c.ultimos4) : '',
            ]
              .filter((x) => x !== '')
              .join('. ')}
          >
            {subtitulo.join(' · ')}
          </Texto>
        ) : null}
      </Encabezado>

      <PlacaSaldo efectivo={c.subtipo === 'efectivo'} centavos={c.saldo} nombre={c.nombre} />

      <Tarjeta testID="cuenta-detalle-saldo-tarjeta">
        {c.corregible ? (
          corrigiendo ? (
            <View style={{ gap: espacio.s }}>
              <CampoMonto
                testID="cuenta-detalle-saldo-real"
                etiqueta={ETIQUETA_SALDO_REAL}
                ayuda={AYUDA_SALDO_REAL}
                alCambiar={setSaldoReal}
                admiteCero
                autoFocus
              />
              <Boton
                testID="cuenta-detalle-guardar-saldo"
                etiqueta={BTN_GUARDAR_SALDO}
                pista={PISTA_GUARDAR_SALDO}
                alPresionar={guardarSaldo}
              />
              <Boton
                testID="cuenta-detalle-cancelar"
                variante="texto"
                etiqueta={BTN_CANCELAR}
                alPresionar={() => {
                  setCorrigiendo(false);
                  setSaldoReal(null);
                  setMensajeBase(null);
                }}
              />
            </View>
          ) : (
            <Boton
              testID="cuenta-detalle-corregir"
              variante="secundario"
              etiqueta={BTN_CORREGIR_SALDO}
              pista={PISTA_CORREGIR_SALDO}
              alPresionar={() => {
                setMensajeBase(null);
                setCorrigiendo(true);
              }}
            />
          )
        ) : (
          <>
            <Texto variante="secundario" tono="secundario" testID="cuenta-detalle-efectivo">
              {TEXTO_EFECTIVO_SE_CUENTA}
            </Texto>
            {alContarEfectivo ? (
              <Boton
                testID="cuenta-detalle-contar"
                variante="secundario"
                etiqueta={TITULO_CONTAR_EFECTIVO}
                etiquetaAccesible={etiquetaContarEnCuenta(c.nombre)}
                alPresionar={() => alContarEfectivo(c.id)}
              />
            ) : null}
          </>
        )}
        <MensajeEnLinea
          texto={mensaje?.texto ?? null}
          error={mensaje?.error ?? false}
          testID="cuenta-detalle-mensaje"
        />
      </Tarjeta>

      <Boton
        testID="cuenta-detalle-movimientos"
        variante="secundario"
        etiqueta={BTN_VER_MOVIMIENTOS}
        pista={PISTA_VER_MOVIMIENTOS_CUENTA}
        alPresionar={() => alVerMovimientos(c.id)}
      />
    </Pantalla>
  );
}

/** La placa del saldo con el color de la cuenta (efectivo menta, débito azul; `D6`), con el anillo de adorno. */
function PlacaSaldo({
  efectivo,
  centavos,
  nombre,
}: {
  efectivo: boolean;
  centavos: Centavos;
  nombre: string;
}) {
  const { esquema } = useTema();
  const p = coloresCuenta[esquema][efectivo ? 'efectivo' : 'debito'];
  return (
    <View
      testID="cuenta-detalle-placa"
      style={{
        backgroundColor: p.fondo,
        borderRadius: radio.xl,
        padding: espacio.xl,
        gap: espacio.s,
        overflow: 'hidden',
        ...sombra.tarjeta[esquema],
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          right: -60,
          top: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          borderWidth: 28,
          borderColor: p.adorno,
        }}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icono nombre={efectivo ? 'billete' : 'banco'} color={p.textoSecundario} tamano={18} grosor={2} />
        <Texto variante="etiqueta" style={{ color: p.textoSecundario }}>
          {ETIQUETA_TIENES}
        </Texto>
      </View>
      <Cifra
        centavos={centavos}
        tamano="heroe"
        contexto={`En ${nombre} tienes`}
        testID="cuenta-detalle-saldo"
        style={{ color: p.texto, fontWeight: '300', letterSpacing: -1 }}
      />
    </View>
  );
}
