import { EstadoCamion } from '../enums/EstadoCamion';
import { TipoCamion } from '../enums/TipoCamion';
import { Orden } from './Orden';

export class Camion {
  private estado: EstadoCamion = EstadoCamion.ACOPLADO;

  constructor(
    public readonly id: string,
    public readonly tipo: TipoCamion,
    public readonly muelleId: string,
    public readonly tickLlegada: number,
    public readonly ordenes: Orden[]
  ) {}

  public getEstado(): EstadoCamion {
    return this.estado;
  }

  public liberarOrdenes(): void {
    if (this.estado === EstadoCamion.ACOPLADO) {
      this.estado = EstadoCamion.ORDENES_LIBERADAS;
    }
  }

  public retirar(): void {
    this.estado = EstadoCamion.RETIRADO;
  }

  public estaRetirado(): boolean {
    return this.estado === EstadoCamion.RETIRADO;
  }

  public tieneOrdenesLiberadas(): boolean {
    return this.estado === EstadoCamion.ORDENES_LIBERADAS;
  }

  public todasLasOrdenesCompletadas(): boolean {
    return this.ordenes.every((orden) => orden.estaCompletada());
  }
}
