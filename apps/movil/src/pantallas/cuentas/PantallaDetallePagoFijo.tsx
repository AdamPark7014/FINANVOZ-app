import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import { cambiarMontoPagoFijo, detallePagoFijo, quitarPagoFijoActivo } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, Cifra, espacio, EstadoVacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { capitalizar, describirRegla } from '../onboarding/pagos-fijos';
import { conAnuncio, Encabezado, MensajeEnLinea } from './Encabezado';
import {
  BTN_CAMBIAR_MONTO,
  BTN_CANCELAR,
  BTN_GUARDAR_MONTO,
  BTN_QUITAR_CONFIRMAR,
  BTN_QUITAR_PAGO,
  COMPROMISO_DE_OTRA_PANTALLA,
  confirmacionMonto,
  confirmacionPagoQuitado,
  ERROR_GUARDAR,
  ERROR_MONTO_NUEVO,
  ETIQUETA_MONTO_NUEVO,
  ETIQUETA_MONTO_PAGO,
  PISTA_CAMBIAR_MONTO,
  PISTA_GUARDAR_MONTO,
  PISTA_QUITAR_CANCELAR,
  PISTA_QUITAR_CONFIRMAR,
  PISTA_QUITAR_PAGO,
  TEXTO_MONTO_VARIABLE,
  TEXTO_PAGO_NO_ENCONTRADO,
  TEXTO_QUITAR_CONFIRMA,
  textoHasta,
  textoProximoPago,
  textoSaleDe,
  TITULO_PAGOS_FIJOS,
} from './textos';

/**
 * Detalle de un compromiso (Cuentas › Compromisos): cada cuándo, monto, de dónde sale, el próximo pago y, si es un
 * pago fijo, «Cambiar monto» y «Quitar este pago» (con confirmación). Los pagos planeados de una tarjeta, las
 * aportaciones de una tanda y las suscripciones se mandan a su propia pantalla.
 */
export function PantallaDetallePagoFijo({
  programadoId,
  alVolver,
  alQuitado,
  alAbrirTarjeta,
  alAbrirTanda,
  alAbrirSuscripciones,
}: {
  programadoId: string;
  alVolver: () => void;
  /** Tras quitarlo: recibe la confirmación («Listo: quité renta.») y regresa. */
  alQuitado: (confirmacion: string) => void;
  alAbrirTarjeta?: (tarjetaId: string) => void;
  alAbrirTanda?: (tandaId: string) => void;
  alAbrirSuscripciones?: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const p = useVista((x) => detallePagoFijo(x, programadoId));
  const [paso, setPaso] = useState<'ver' | 'monto' | 'quitar'>('ver');
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [mensaje, setMensajeBase] = useState<{ texto: string; error: boolean } | null>(null);
  const avisar = (texto: string, error: boolean) =>
    conAnuncio((t) => setMensajeBase(t ? { texto: t, error } : null))(texto);

  if (!p) {
    return (
      <Pantalla testID="pago-detalle" bordes={['top', 'left', 'right', 'bottom']}>
        <Encabezado titulo={TITULO_PAGOS_FIJOS} alVolver={alVolver} testID="pago-detalle" />
        <EstadoVacio texto={TEXTO_PAGO_NO_ENCONTRADO} testID="pago-detalle-no-encontrado" />
      </Pantalla>
    );
  }

  const titulo = capitalizar(p.concepto);
  const regla = describirRegla(p.regla);
  const detalles = [
    regla,
    textoProximoPago(p.proxima),
    p.cuenta ? textoSaleDe(p.cuenta) : null,
    p.hasta ? textoHasta(p.hasta) : null,
  ].filter((x): x is string => x !== null);

  const guardarMonto = () => {
    if (monto === null || monto <= 0) {
      avisar(ERROR_MONTO_NUEVO, true);
      return;
    }
    try {
      cambiarMontoPagoFijo(ctx, p.id, monto);
    } catch {
      avisar(ERROR_GUARDAR, true);
      return;
    }
    setPaso('ver');
    setMonto(null);
    avisar(confirmacionMonto(p.concepto, monto), false);
    refrescar();
  };

  const quitar = () => {
    try {
      quitarPagoFijoActivo(ctx, p.id);
    } catch {
      avisar(ERROR_GUARDAR, true);
      return;
    }
    refrescar();
    alQuitado(confirmacionPagoQuitado(p.concepto));
  };

  const otra = p.origen === 'pago_fijo' ? null : COMPROMISO_DE_OTRA_PANTALLA[p.origen];
  const abrirOtra =
    p.origen === 'tarjeta' && p.tarjetaId && alAbrirTarjeta
      ? () => alAbrirTarjeta(p.tarjetaId as string)
      : p.origen === 'tanda' && p.tandaId && alAbrirTanda
        ? () => alAbrirTanda(p.tandaId as string)
        : p.origen === 'suscripcion' && alAbrirSuscripciones
          ? alAbrirSuscripciones
          : null;

  return (
    <Pantalla testID="pago-detalle" bordes={['top', 'left', 'right', 'bottom']}>
      <Encabezado titulo={titulo} alVolver={alVolver} testID="pago-detalle" />
      <Tarjeta testID="pago-detalle-resumen">
        <Texto
          variante="etiqueta"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {ETIQUETA_MONTO_PAGO}
        </Texto>
        <Cifra
          centavos={p.monto}
          tamano="grande"
          contexto={`${titulo}, apartas`}
          testID="pago-detalle-monto"
        />
        {p.variable ? (
          <Texto variante="secundario" tono="secundario">
            {TEXTO_MONTO_VARIABLE}
          </Texto>
        ) : null}
        {detalles.map((d) => (
          <Texto key={d} variante="cuerpo">
            {d}
          </Texto>
        ))}
        <MensajeEnLinea
          texto={mensaje?.texto ?? null}
          error={mensaje?.error ?? false}
          testID="pago-detalle-mensaje"
        />
      </Tarjeta>

      {otra ? (
        <Tarjeta testID="pago-detalle-otra-pantalla">
          <Texto variante="cuerpo">{otra.texto}</Texto>
          {abrirOtra ? (
            <Boton
              testID="pago-detalle-abrir-otra"
              variante="secundario"
              etiqueta={otra.boton}
              pista={otra.pista}
              alPresionar={abrirOtra}
            />
          ) : null}
        </Tarjeta>
      ) : paso === 'monto' ? (
        <Tarjeta testID="pago-detalle-cambiar">
          <CampoMonto
            testID="pago-detalle-monto-nuevo"
            etiqueta={ETIQUETA_MONTO_NUEVO}
            valorInicial={p.monto}
            alCambiar={setMonto}
            autoFocus
          />
          <Boton
            testID="pago-detalle-guardar-monto"
            etiqueta={BTN_GUARDAR_MONTO}
            pista={PISTA_GUARDAR_MONTO}
            alPresionar={guardarMonto}
          />
          <Boton
            testID="pago-detalle-cancelar"
            variante="texto"
            etiqueta={BTN_CANCELAR}
            alPresionar={() => {
              setPaso('ver');
              setMonto(null);
            }}
          />
        </Tarjeta>
      ) : paso === 'quitar' ? (
        <Tarjeta testID="pago-detalle-quitar-confirma">
          <Texto variante="cuerpo" accessibilityRole="alert">
            {TEXTO_QUITAR_CONFIRMA}
          </Texto>
          <Boton
            testID="pago-detalle-quitar-confirmar"
            etiqueta={BTN_QUITAR_CONFIRMAR}
            pista={PISTA_QUITAR_CONFIRMAR}
            alPresionar={quitar}
          />
          <Boton
            testID="pago-detalle-quitar-cancelar"
            variante="texto"
            etiqueta={BTN_CANCELAR}
            pista={PISTA_QUITAR_CANCELAR}
            alPresionar={() => setPaso('ver')}
          />
        </Tarjeta>
      ) : (
        <View style={{ gap: espacio.s }}>
          <Boton
            testID="pago-detalle-cambiar-monto"
            variante="secundario"
            etiqueta={BTN_CAMBIAR_MONTO}
            pista={PISTA_CAMBIAR_MONTO}
            alPresionar={() => {
              setMensajeBase(null);
              setMonto(p.monto);
              setPaso('monto');
            }}
          />
          <Boton
            testID="pago-detalle-quitar"
            variante="texto"
            etiqueta={BTN_QUITAR_PAGO}
            pista={PISTA_QUITAR_PAGO}
            alPresionar={() => {
              setMensajeBase(null);
              setPaso('quitar');
            }}
          />
        </View>
      )}
    </Pantalla>
  );
}
