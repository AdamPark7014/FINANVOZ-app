/** Error de dominio con `codigo` estable; el mensaje es para desarrolladores, nunca para la UI. */
export class ErrorDominio extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
  }
}
