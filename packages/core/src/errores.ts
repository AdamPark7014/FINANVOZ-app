/** Error de dominio con `codigo` estable; el mensaje es para desarrolladores, nunca para la UI. */
export class ErrorDominio<C extends string = string> extends Error {
  readonly codigo: C;

  constructor(codigo: C, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDominio';
    this.codigo = codigo;
  }
}
