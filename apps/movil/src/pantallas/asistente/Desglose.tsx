import type { ReactNode } from 'react';
import { View } from 'react-native';
import { etiquetaFecha, type ConceptoReservado, type VistaHoy } from '../../servicios';
import { Cifra, cifraEnPalabras, espacio, Tarjeta, Texto } from '../../ui';

const ROTULO_RESERVADO: Record<ConceptoReservado['tipo'], string> = {
  tarjeta: 'tarjeta',
  compromiso: 'pago',
  msi: 'meses',
  persona: 'le debes',
};

const ESTILO_CONCEPTO = { flexGrow: 1, flexShrink: 1 } as const;

/**
 * Concepto y monto como un solo elemento del lector («Libre: ochocientos cincuenta y seis pesos»). Con texto grande
 * (200 %) la cifra baja de renglón en vez de apretarse.
 */
function FilaCifra({
  etiqueta,
  centavos,
  sangria = false,
  children,
}: {
  etiqueta: string;
  centavos: number;
  sangria?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${cifraEnPalabras(centavos)}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        columnGap: espacio.s,
        ...(sangria ? { paddingLeft: espacio.l } : {}),
      }}
    >
      {children}
    </View>
  );
}

function Fila({
  etiqueta,
  centavos,
  fuerte,
  testID,
}: {
  etiqueta: string;
  centavos: number;
  fuerte?: boolean;
  testID?: string;
}) {
  return (
    <FilaCifra etiqueta={etiqueta} centavos={centavos}>
      <Texto variante={fuerte ? 'cuerpoFuerte' : 'cuerpo'} style={ESTILO_CONCEPTO}>
        {etiqueta}
      </Texto>
      <Cifra centavos={centavos} contexto={etiqueta} {...(testID ? { testID } : {})} />
    </FilaCifra>
  );
}

/** «Efectivo y débito · Reservado (Nu, tanda, internet) · Colchón · Libre» (02-UX §4), sin cálculos nuevos. */
export function Desglose({ vista }: { vista: VistaHoy }) {
  const nombres = vista.reservadoDetalle.map((r) => r.concepto);
  return (
    <Tarjeta testID="desglose">
      <Fila etiqueta="Efectivo y débito" centavos={vista.liquidez} testID="desglose-liquidez" />
      <Fila
        etiqueta={nombres.length > 0 ? `Reservado (${nombres.join(', ')})` : 'Reservado'}
        centavos={-vista.reservado}
        testID="desglose-reservado"
      />
      {vista.reservadoDetalle.map((r, i) => {
        const concepto = `${r.concepto} · ${ROTULO_RESERVADO[r.tipo]}${r.fecha ? ` · ${etiquetaFecha(r.fecha)}` : ''}`;
        return (
          <FilaCifra key={i} etiqueta={concepto} centavos={r.monto} sangria>
            <Texto variante="secundario" tono="secundario" style={ESTILO_CONCEPTO}>
              {concepto}
            </Texto>
            <Cifra centavos={r.monto} tamano="secundario" contexto={r.concepto} />
          </FilaCifra>
        );
      })}
      <Fila etiqueta="Colchón" centavos={-vista.colchon} testID="desglose-colchon" />
      <Fila etiqueta="Libre" centavos={vista.libre} fuerte testID="desglose-libre" />
    </Tarjeta>
  );
}
