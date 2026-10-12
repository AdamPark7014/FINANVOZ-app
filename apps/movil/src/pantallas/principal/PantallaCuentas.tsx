import type { ReactNode } from 'react';
import { View } from 'react-native';
import { etiquetaFecha, fijarApartarDeuda, listarCuentas, type CuentaDebes } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, formatearCentavos, Interruptor, Pantalla, Tarjeta, Texto } from '../../ui';

const NOMBRE_SUBTIPO: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  billetera: 'Billetera',
  ahorro: 'Ahorro',
};

/** Cuentas (02-UX §11): Tienes · Debes · Te deben · Compromisos (próximos 30 días). Engrane → Ajustes. */
export function PantallaCuentas({ alAbrirAjustes }: { alAbrirAjustes: () => void }) {
  const v = useVista(listarCuentas);
  return (
    <Pantalla testID="pantalla-cuentas">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Texto variante="titulo">Cuentas</Texto>
        <Boton
          etiqueta="⚙ Ajustes"
          etiquetaAccesible="Ajustes"
          variante="texto"
          ancho="contenido"
          alPresionar={alAbrirAjustes}
          testID="boton-ajustes"
        />
      </View>

      <Seccion titulo="Tienes" testID="seccion-tienes">
        {v.tienes.length === 0 ? <Vacio texto="Todavía no agregas cuentas." /> : null}
        {v.tienes.map((c) => (
          <Fila
            key={c.id}
            testID={`cuenta-${c.id}`}
            titulo={c.nombre}
            subtitulo={NOMBRE_SUBTIPO[c.subtipo] ?? null}
            centavos={c.saldo}
          />
        ))}
      </Seccion>

      <Seccion titulo="Debes" testID="seccion-debes">
        {v.debes.length === 0 ? <Vacio texto="No debes nada registrado." /> : null}
        {v.debes.map((d) =>
          d.tipo === 'tarjeta' ? <TarjetaCredito key={d.id} d={d} /> : <PersonaDebes key={d.id} d={d} />,
        )}
      </Seccion>

      {v.teDeben.length > 0 ? (
        <Seccion titulo="Te deben" testID="seccion-te-deben">
          {v.teDeben.map((p) => (
            <Fila
              key={p.id}
              testID={`te-debe-${p.id}`}
              titulo={p.nombre}
              subtitulo={null}
              centavos={p.saldo}
            />
          ))}
        </Seccion>
      ) : null}

      <Seccion titulo="Compromisos" subtitulo="Próximos 30 días" testID="seccion-compromisos">
        {v.compromisos.length === 0 ? <Vacio texto="No tienes pagos en los próximos 30 días." /> : null}
        {v.compromisos.map((c) => (
          <Fila
            key={`${c.programadoId}:${c.fecha}`}
            titulo={c.concepto}
            subtitulo={etiquetaFecha(c.fecha)}
            centavos={c.monto}
          />
        ))}
      </Seccion>
    </Pantalla>
  );
}

function Seccion({
  titulo,
  subtitulo,
  children,
  testID,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  testID: string;
}) {
  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      <Texto variante="subtitulo">{titulo}</Texto>
      {subtitulo ? (
        <Texto variante="secundario" tono="secundario">
          {subtitulo}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <Texto variante="secundario" tono="secundario">
      {texto}
    </Texto>
  );
}

function Fila({
  titulo,
  subtitulo,
  centavos,
  testID,
}: {
  titulo: string;
  subtitulo: string | null;
  centavos: number;
  testID?: string;
}) {
  return (
    <Tarjeta {...(testID ? { testID } : {})}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{titulo}</Texto>
          {subtitulo ? (
            <Texto variante="secundario" tono="secundario">
              {subtitulo}
            </Texto>
          ) : null}
        </View>
        <Cifra centavos={centavos} contexto={titulo} {...(testID ? { testID: `${testID}-saldo` } : {})} />
      </View>
    </Tarjeta>
  );
}

function TarjetaCredito({ d }: { d: CuentaDebes }) {
  const aFavor = d.saldo < 0;
  return (
    <Tarjeta testID={`cuenta-${d.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{d.nombre}</Texto>
          <Texto variante="secundario" tono="secundario">
            {aFavor ? 'Saldo a favor' : 'Tarjeta de crédito'}
          </Texto>
        </View>
        <Cifra centavos={aFavor ? -d.saldo : d.saldo} contexto={d.nombre} testID={`cuenta-${d.id}-saldo`} />
      </View>
      {d.meses > 0 ? (
        <Texto variante="secundario" testID={`cuenta-${d.id}-meses`}>
          {`Meses sin intereses que faltan: ${formatearCentavos(d.meses)}`}
        </Texto>
      ) : null}
      {d.limiteCredito !== null ? (
        <Texto variante="secundario" tono="secundario">
          {`Límite: ${formatearCentavos(d.limiteCredito)}`}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

/** Persona a la que le debes con "Apartar lo que le debo" (E4, CA-M2-09). */
function PersonaDebes({ d }: { d: CuentaDebes }) {
  const { ctx, refrescar } = useSesion();
  return (
    <Tarjeta testID={`cuenta-${d.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{d.nombre}</Texto>
          <Texto variante="secundario" tono="secundario">
            Le debes
          </Texto>
        </View>
        <Cifra centavos={d.saldo} contexto={`Le debes a ${d.nombre}`} testID={`cuenta-${d.id}-saldo`} />
      </View>
      <Interruptor
        etiqueta="Apartar lo que le debo"
        descripcion={
          d.apartar
            ? 'Lo que le debes no cuenta como dinero libre.'
            : 'Lo que le debes cuenta como dinero libre.'
        }
        valor={d.apartar === true}
        alCambiar={(valor) => {
          fijarApartarDeuda(ctx, d.id, valor);
          refrescar();
        }}
        testID={`apartar-${d.id}`}
      />
    </Tarjeta>
  );
}
