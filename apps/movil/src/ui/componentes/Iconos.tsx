import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Íconos de línea de la dirección B (`docs/diseno/direccion-b/`), con los mismos trazos que los tableros (estilo
 * Lucide, retícula de 24). Son decorativos: quien los usa pone el nombre en su etiqueta accesible, así que el lector
 * nunca los lee (`02 §15`: ninguna información solo por ícono).
 */
export type NombreIcono =
  | 'microfono'
  | 'teclado'
  | 'buscar'
  | 'mas'
  | 'chevronDerecha'
  | 'chevronAbajo'
  | 'palomita'
  | 'alerta'
  | 'vaso'
  | 'cubiertos'
  | 'carrito'
  | 'boleto'
  | 'coche'
  | 'tarjeta'
  | 'billete'
  | 'banco'
  | 'moneda'
  | 'casa'
  | 'rayo'
  | 'corazon'
  | 'regalo'
  | 'camisa'
  | 'celular'
  | 'repetir'
  | 'libro'
  | 'personas'
  | 'porcentaje'
  | 'cerrar'
  | 'llama';

function trazos(nombre: NombreIcono): ReactNode {
  switch (nombre) {
    case 'microfono':
      return (
        <>
          <Rect x={9} y={2} width={6} height={12} rx={3} />
          <Path d="M5 10v1a7 7 0 0 0 14 0v-1" />
          <Path d="M12 18v4" />
        </>
      );
    case 'teclado':
      return (
        <>
          <Rect x={2} y={6} width={20} height={12} rx={2} />
          <Path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
        </>
      );
    case 'buscar':
      return (
        <>
          <Circle cx={11} cy={11} r={7} />
          <Path d="m20 20-3.5-3.5" />
        </>
      );
    case 'mas':
      return <Path d="M12 5v14M5 12h14" />;
    case 'chevronDerecha':
      return <Path d="m9 18 6-6-6-6" />;
    case 'chevronAbajo':
      return <Path d="m6 9 6 6 6-6" />;
    case 'palomita':
      return <Path d="M20 6 9 17l-5-5" />;
    case 'cerrar':
      return <Path d="M18 6 6 18M6 6l12 12" />;
    case 'llama':
      return (
        <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      );
    case 'alerta':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7.5v5M12 16.5h.01" />
        </>
      );
    case 'vaso':
      return (
        <>
          <Path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8" />
          <Path d="M5 8h14" />
          <Path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
          <Path d="m12 8 1-6h2" />
        </>
      );
    case 'cubiertos':
      return (
        <>
          <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <Path d="M7 2v20" />
          <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </>
      );
    case 'carrito':
      return (
        <>
          <Circle cx={8} cy={21} r={1} />
          <Circle cx={19} cy={21} r={1} />
          <Path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </>
      );
    case 'boleto':
      return (
        <>
          <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <Path d="M13 5v2M13 17v2M13 11v2" />
        </>
      );
    case 'coche':
      return (
        <>
          <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0 0 13.7 6H6.3a2 2 0 0 0-1.6.8L2 10.5V16c0 .6.4 1 1 1h2" />
          <Circle cx={7} cy={17} r={2} />
          <Circle cx={17} cy={17} r={2} />
          <Path d="M9 17h6" />
        </>
      );
    case 'tarjeta':
      return (
        <>
          <Rect x={2} y={5} width={20} height={14} rx={2} />
          <Path d="M2 10h20" />
        </>
      );
    case 'billete':
      return (
        <>
          <Rect x={2} y={6} width={20} height={12} rx={2} />
          <Circle cx={12} cy={12} r={2.5} />
          <Path d="M6 12h.01M18 12h.01" />
        </>
      );
    case 'banco':
      return <Path d="M3 21h18M5 18v-7M9.5 18v-7M14.5 18v-7M19 18v-7M12 3l9 5H3z" />;
    case 'moneda':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 6.5v11M15 9.2c0-1.2-1.3-1.9-3-1.9s-3 .8-3 2 1.3 1.7 3 2.1 3 1 3 2.3-1.3 2-3 2-3-.8-3-2" />
        </>
      );
    case 'casa':
      return (
        <>
          <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Path d="M9 22V12h6v10" />
        </>
      );
    case 'rayo':
      return <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />;
    case 'corazon':
      return (
        <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      );
    case 'regalo':
      return (
        <>
          <Rect x={3} y={8} width={18} height={4} rx={1} />
          <Path d="M12 8v13" />
          <Path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <Path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 11 5.5 12 8c1-2.5 2.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
        </>
      );
    case 'camisa':
      return (
        <Path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
      );
    case 'celular':
      return (
        <>
          <Rect x={5} y={2} width={14} height={20} rx={2} />
          <Path d="M12 18h.01" />
        </>
      );
    case 'repetir':
      return (
        <>
          <Path d="m17 2 4 4-4 4" />
          <Path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <Path d="m7 22-4-4 4-4" />
          <Path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </>
      );
    case 'libro':
      return <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />;
    case 'personas':
      return (
        <>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case 'porcentaje':
      return (
        <>
          <Path d="M19 5 5 19" />
          <Circle cx={6.5} cy={6.5} r={2.5} />
          <Circle cx={17.5} cy={17.5} r={2.5} />
        </>
      );
  }
}

/** Ícono de línea (decorativo, oculto al lector). `grosor` en unidades de la retícula de 24. */
export function Icono({
  nombre,
  color,
  tamano = 20,
  grosor = 1.8,
  testID,
}: {
  nombre: NombreIcono;
  color: string;
  tamano?: number;
  grosor?: number;
  testID?: string;
}) {
  return (
    <Svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID ? { testID } : {})}
    >
      {trazos(nombre)}
    </Svg>
  );
}

/**
 * Anillo del temporizador de «Deshacer» (B2): el riel en `riel` y lo que falta en `color`, empezando arriba. `parte`
 * va de 0 (se acabó) a 1 (recién registrado).
 */
export function AnilloTiempo({
  parte,
  color,
  riel,
  tamano = 20,
}: {
  parte: number;
  color: string;
  riel: string;
  tamano?: number;
}) {
  const r = 9;
  const vuelta = 2 * Math.PI * r;
  const lleno = Math.max(0, Math.min(1, parte)) * vuelta;
  return (
    <Svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={12} cy={12} r={r} fill="none" stroke={riel} strokeWidth={3} />
      {lleno > 0 ? (
        <Circle
          cx={12}
          cy={12}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${lleno} ${vuelta}`}
          transform="rotate(-90 12 12)"
        />
      ) : null}
    </Svg>
  );
}

/** Ícono de cada categoría del catálogo (`04 §2.3`); las que no tienen uno propio llevan la moneda. */
const ICONO_CATEGORIA: Record<string, NombreIcono> = {
  comida_fuera: 'cubiertos',
  antojos: 'vaso',
  super: 'carrito',
  transporte: 'coche',
  gasolina: 'coche',
  entretenimiento: 'boleto',
  viajes: 'boleto',
  ropa: 'camisa',
  hogar: 'casa',
  vivienda: 'casa',
  salud: 'corazon',
  cuidado_personal: 'corazon',
  mascotas: 'corazon',
  regalos: 'regalo',
  regalo_recibido: 'regalo',
  apoyo_familiar: 'personas',
  tecnologia: 'celular',
  servicios: 'rayo',
  suscripciones: 'repetir',
  educacion: 'libro',
  comisiones_intereses: 'porcentaje',
  sueldo: 'billete',
  honorarios: 'billete',
  ventas: 'billete',
  reembolso: 'billete',
  rendimientos: 'billete',
  otros_ingresos: 'billete',
  varios_efectivo: 'billete',
};

export function iconoDeCategoria(slug: string | null | undefined): NombreIcono {
  return (slug ? ICONO_CATEGORIA[slug] : undefined) ?? 'moneda';
}
