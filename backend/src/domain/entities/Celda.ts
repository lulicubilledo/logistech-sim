import { TipoCelda } from '../enums/TipoCelda';
import { Paquete } from './Paquete';
import { Posicion } from './Posicion';

export class Celda {
  private paquete: Paquete | null = null;
  private robotId: string | null = null;
  private reservaRobotId: string | null = null;
  private camionId: string | null = null;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly tipo: TipoCelda,
    public readonly id: string | null = null
  ) {}

  public posicion(): Posicion {
    return { x: this.x, y: this.y };
  }

  public estaOcupadaPorRobot(): boolean {
    return this.robotId !== null;
  }

  public getRobotId(): string | null {
    return this.robotId;
  }

  public ocuparConRobot(robotId: string): void {
    this.robotId = robotId;
  }

  public liberarRobot(): void {
    this.robotId = null;
  }

  public reservarPara(robotId: string): void {
    this.reservaRobotId = robotId;
  }

  public liberarReserva(): void {
    this.reservaRobotId = null;
  }

  public estaReservadaPorOtro(robotId: string): boolean {
    return this.reservaRobotId !== null && this.reservaRobotId !== robotId;
  }

  public estaReservada(): boolean {
    return this.reservaRobotId !== null;
  }

  public getReservaRobotId(): string | null {
    return this.reservaRobotId;
  }

  public acoplarCamion(camionId: string): void {
    this.camionId = camionId;
  }

  public desacoplarCamion(): void {
    this.camionId = null;
  }

  public getCamionId(): string | null {
    return this.camionId;
  }

  public estaDisponibleParaAlmacenar(): boolean {
    return this.tipo === TipoCelda.ESTANTERIA && this.paquete === null && this.reservaRobotId === null;
  }

  public tienePaquete(): boolean {
    return this.paquete !== null;
  }

  public getPaquete(): Paquete | null {
    return this.paquete;
  }

  public almacenarPaquete(paquete: Paquete): void {
    if (this.tipo !== TipoCelda.ESTANTERIA) {
      throw new Error('Solo se puede almacenar en estanterias');
    }
    if (this.paquete !== null) {
      throw new Error('La estanteria ya contiene un paquete');
    }
    this.paquete = paquete;
  }

  public retirarPaquete(): Paquete {
    if (this.paquete === null) {
      throw new Error('No hay paquete para retirar');
    }
    const paquete = this.paquete;
    this.paquete = null;
    return paquete;
  }
}
