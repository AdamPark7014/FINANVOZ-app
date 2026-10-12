import { useState } from 'react';
import { Platform, View } from 'react-native';
import { confirmarArqueo, posponerArqueo, type TarjetaAccion } from '../../servicios';
import { useCaptura } from '../../captura/ProveedorCaptura';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from '../principal/Chip';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { MENSAJE_ERROR_GENERAL } from '../principal/textos';

type Arqueo = Extract<TarjetaAccion, { tipo: 'arqueo' }>;

/**
 * 4. Arqueo pendiente (`02 §7`): "Deberías traer $640 en efectivo. ¿Cuánto traes?" con "$640" (exacto, un
 * toque), "Otra cantidad" (abre el arqueo) y "Ahora no". Con gastos por asignar viejos abre el paso 1.
 */
export function TarjetaArqueo({
  t,
  testID,
  alAbrirArqueo,
}: {
  t: Arqueo;
  testID: string;
  alAbrirArqueo: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const registrarEvento = useAnalitica();
  const mostrar = useMostrarAviso();
  const [error, setError] = useState<string | null>(null);
  const exacto = formatearCentavos(t.saldo);
  const elegir = (o: 'exacto' | 'otra_cantidad' | 'ahora_no') => {
    setError(null);
    if (o === 'otra_cantidad') return alAbrirArqueo();
    try {
      if (o === 'exacto') {
        confirmarArqueo(ctx, { cuentaId: t.cuentaId, efectivoReal: t.saldo });
        registrarEvento({ nombre: 'arqueo', propiedades: { resultado: 'exacto' } });
      } else posponerArqueo(ctx);
      refrescar();
      mostrar({
        mensaje: o === 'exacto' ? 'Listo: tu efectivo cuadra.' : 'Va. Te pregunto mañana.',
      });
    } catch {
      setError(MENSAJE_ERROR_GENERAL);
    }
  };
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{`Deberías traer ${exacto} en efectivo. ¿Cuánto traes?`}</Texto>
      {t.conPorAsignar ? (
        <View style={{ gap: espacio.s }}>
          <Texto variante="secundario" tono="secundario">
            Antes revisemos unos gastos que no sé con qué pagaste.
          </Texto>
          <Boton etiqueta="Contar mi efectivo" alPresionar={alAbrirArqueo} testID={`${testID}-abrir`} />
          <Boton
            etiqueta="Ahora no"
            variante="texto"
            alPresionar={() => elegir('ahora_no')}
            testID={`${testID}-ahora_no`}
          />
        </View>
      ) : (
        <GrupoChips
          opciones={[
            { valor: 'exacto', etiqueta: exacto },
            { valor: 'otra_cantidad', etiqueta: 'Otra cantidad' },
            { valor: 'ahora_no', etiqueta: 'Ahora no' },
          ]}
          valor={null}
          alCambiar={elegir}
          prefijoTestID={testID}
        />
      )}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

/** Guía según la marca del teléfono (RF-CAP-07): las capas que más cortan servicios en segundo plano. */
export function guiaCapturaInactiva(marca: string | null): string {
  const base =
    'Abre el acceso a notificaciones y revisa que Finanvoz esté activado. Si ya lo está, apágalo y vuelve a encenderlo.';
  switch ((marca ?? '').toLowerCase()) {
    case 'xiaomi':
    case 'redmi':
    case 'poco':
      return `${base} En Xiaomi, activa también "Inicio automático" y quita el ahorro de batería para Finanvoz.`;
    case 'huawei':
    case 'honor':
      return `${base} En Huawei, en Batería → Inicio de apps, deja que Finanvoz se administre manualmente.`;
    case 'samsung':
      return `${base} En Samsung, quita a Finanvoz de "Apps en suspensión" en Cuidado del dispositivo → Batería.`;
    case 'motorola':
    case 'oppo':
    case 'realme':
    case 'vivo':
      return `${base} Quita también la optimización de batería para Finanvoz.`;
    default:
      return base;
  }
}

function marcaTelefono(): string | null {
  if (Platform.OS !== 'android') return null;
  const c = Platform.constants as { Brand?: string } | undefined;
  return c?.Brand ?? null;
}

/** 5. Captura inactiva (RF-CAP-07, CA-M5-06). */
export function TarjetaCapturaInactiva({ testID }: { testID: string }) {
  const { puente } = useCaptura();
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">
        No he visto notificaciones de tu banco en 3 días. Revisa que la captura siga activa.
      </Texto>
      <Texto variante="secundario" tono="secundario" testID={`${testID}-guia`}>
        {guiaCapturaInactiva(marcaTelefono())}
      </Texto>
      {puente ? (
        <Boton
          etiqueta="Revisar el acceso"
          variante="secundario"
          alPresionar={() => {
            void puente.solicitarReconexion();
            void puente.abrirAjustesPermiso();
          }}
          testID={`${testID}-revisar`}
        />
      ) : null}
    </Tarjeta>
  );
}
