export function citar(s: string): string;
export function partirArgumentosSh(comando: string): string[];
export function comandoPublicar(etiqueta: string, titulo: string, texto: string): string;
export function etiquetasPorPaquete(): Map<string, string>;
export function leerEjemplos(
  negocio?: boolean,
): { id: string; paquete: string; titulo: string; texto: string }[];
