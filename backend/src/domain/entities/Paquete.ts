import { TipoPaquete } from '../enums/TipoPaquete';

export class Paquete {
  constructor(
    public readonly id: string,
    public readonly tipo: TipoPaquete,
    public readonly peso: number,
    public readonly vencimiento: Date | null = null
  ) {}

  public esComestible(): boolean {
    return this.tipo === TipoPaquete.COMESTIBLE;
  }
}
