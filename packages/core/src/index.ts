export { type Centavos, type PuntosBase, esCentavos, exigirCentavos } from './dinero';
export { ErrorDominio } from './errores';
export { distribuirMayorResiduo } from './reparto';
export {
  capacidadEndeudamiento,
  PARAMETROS_CAPACIDAD,
  PLAZOS_MSI,
  type EntradaCapacidad,
  type Limitante,
  type ParametrosCapacidad,
  type PlazoMsi,
  type ResultadoCapacidad,
  type ResultadoCompra,
} from './capacidad';
export * from './fecha';
export { porcentajeMostrado, redondearPorcentaje } from './porcentaje';
export * from './motores-ingreso';
export * from './motores-tarjetas-personas';
export * from './motores-captura';
export * from './libro';
