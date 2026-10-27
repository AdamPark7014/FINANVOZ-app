import { Pressable, Text, View } from 'react-native';
import {
  dockVoz,
  espacio,
  Icono,
  OBJETIVO_TACTIL_MIN,
  radio,
  sombra,
  Texto,
  useTema,
  type NombreIcono,
} from '../../ui';
import { useAnuncio } from '../principal/ProveedorAvisos';
import { BTN_AGREGAR_TARJETA_CREDITO, PISTA_AGREGAR_TARJETA_CREDITO } from '../principal/textos';
import {
  BTN_AGREGAR_CUENTA,
  BTN_AGREGAR_PAGO_FIJO,
  PISTA_AGREGAR_CUENTA,
  PISTA_AGREGAR_PAGO_FIJO,
  TITULO_MENU_AGREGAR,
} from './textos';

interface OpcionAgregar {
  readonly etiqueta: string;
  readonly pista: string;
  readonly icono: NombreIcono;
  readonly testID: string;
  readonly alPresionar?: (() => void) | undefined;
}

/**
 * «Agregar» del dock de Cuentas (dirección B): una cuenta (débito, billetera o ahorro), una tarjeta de crédito o un
 * pago fijo. Flota sobre el dock; elegir una opción lo cierra y abre su formulario. Conserva los testID de los
 * botones que antes vivían en cada sección (`boton-agregar-cuenta`, `boton-agregar-tarjeta`,
 * `boton-agregar-pago-fijo`).
 */
export function MenuAgregar({
  abajo,
  alCerrar,
  alAgregarCuenta,
  alAgregarTarjeta,
  alAgregarPagoFijo,
}: {
  /** Distancia del dock al borde (`useMedidasDock`): el menú va justo encima. */
  abajo: number;
  alCerrar: () => void;
  alAgregarCuenta?: () => void;
  alAgregarTarjeta?: () => void;
  alAgregarPagoFijo?: () => void;
}) {
  const { c, esquema } = useTema();
  useAnuncio(TITULO_MENU_AGREGAR);
  const opciones: OpcionAgregar[] = [
    {
      etiqueta: BTN_AGREGAR_CUENTA,
      pista: PISTA_AGREGAR_CUENTA,
      icono: 'banco',
      testID: 'boton-agregar-cuenta',
      alPresionar: alAgregarCuenta,
    },
    {
      etiqueta: BTN_AGREGAR_TARJETA_CREDITO,
      pista: PISTA_AGREGAR_TARJETA_CREDITO,
      icono: 'tarjeta',
      testID: 'boton-agregar-tarjeta',
      alPresionar: alAgregarTarjeta,
    },
    {
      etiqueta: BTN_AGREGAR_PAGO_FIJO,
      pista: PISTA_AGREGAR_PAGO_FIJO,
      icono: 'repetir',
      testID: 'boton-agregar-pago-fijo',
      alPresionar: alAgregarPagoFijo,
    },
  ];
  return (
    <View
      testID="menu-agregar"
      style={{
        position: 'absolute',
        left: dockVoz.margenLateral,
        right: dockVoz.margenLateral,
        bottom: abajo + dockVoz.alto + espacio.s,
        backgroundColor: c.superficie,
        borderRadius: radio.l + 4,
        borderWidth: 1,
        borderColor: c.borde,
        padding: espacio.s,
        gap: espacio.xxs,
        ...sombra.aviso[esquema],
      }}
    >
      <Texto
        variante="etiqueta"
        tono="secundario"
        accessibilityRole="header"
        style={{ paddingHorizontal: espacio.m, paddingTop: espacio.s, paddingBottom: espacio.xs }}
      >
        {TITULO_MENU_AGREGAR}
      </Texto>
      {opciones.map((o) =>
        o.alPresionar ? (
          <Pressable
            key={o.testID}
            testID={o.testID}
            onPress={() => {
              alCerrar();
              o.alPresionar?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={o.etiqueta}
            accessibilityHint={o.pista}
            style={({ pressed }) => ({
              minHeight: OBJETIVO_TACTIL_MIN + 8,
              borderRadius: radio.m,
              paddingHorizontal: espacio.m,
              flexDirection: 'row',
              alignItems: 'center',
              gap: espacio.m,
              backgroundColor: pressed ? c.superficieAlterna : 'transparent',
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radio.m,
                backgroundColor: c.iconoFondo,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre={o.icono} color={c.acento} />
            </View>
            <Text
              importantForAccessibility="no"
              style={{ fontSize: 16, lineHeight: 22, fontWeight: '600', color: c.texto }}
            >
              {o.etiqueta}
            </Text>
          </Pressable>
        ) : null,
      )}
    </View>
  );
}
