import { Paquete } from './Paquete';
import { TipoCamion } from '../enums/TipoCamion';

export class Orden {
  private completada: boolean = false;
  private asignada: boolean = false;

  constructor(
    public readonly id: string,
    public readonly camionId: string,
    public readonly paquete: Paquete,
    public readonly tipoCamion: TipoCamion
  ) {}

  public estaCompletada(): boolean {
    return this.completada;
  }

  public estaAsignada(): boolean {
    return this.asignada;
  }

  public marcarAsignada(): void {
    this.asignada = true;
  }

  public liberarAsignacion(): void {
    this.asignada = false;
  }

  public completar(): void {
    this.completada = true;
    this.asignada = false;
  }
}
