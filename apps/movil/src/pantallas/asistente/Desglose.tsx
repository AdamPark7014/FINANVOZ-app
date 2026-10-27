import { nombresLiquidez, type VistaHoy } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { TarjetaCalculo } from './TarjetaCalculo';
import { filasCalculoDia } from './textos';

/**
 * «Cómo lo calculé» del día (dirección B, tableros B1 y B3): lo que tienes en efectivo y débito, lo reservado con sus
 * nombres, el colchón y lo libre entre los días que faltan, con lo que puedes gastar al día. Sin cálculos nuevos:
 * todo sale de `VistaHoy` (E4, regla 4). testID `desglose` y una fila por concepto (`desglose-liquidez`,
 * `desglose-reservado`, `desglose-colchon`, `desglose-libre`).
 */
export function Desglose({ vista }: { vista: VistaHoy }) {
  const nombres = useVista(nombresLiquidez);
  return <TarjetaCalculo testID="desglose" filas={filasCalculoDia(vista, nombres)} />;
}
