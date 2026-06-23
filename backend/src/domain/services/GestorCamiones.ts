import { EstadoCamion } from '../enums/EstadoCamion';
import { Camion } from '../entities/Camion';
import { Celda } from '../entities/Celda';

export interface ContextoGestionCamiones {
  tickActual: number;
  buscarMuellePorId(id: string): Celda | null;
  hayRobotEnCelda(celda: Celda): boolean;
  muelleOcupadoAlInicioDelTick(celda: Celda): boolean;
}

export class GestorCamiones {
  private readonly camiones = new Map<string, Camion>();
  private readonly camionesEsperandoAcople: Camion[] = [];

  public registrarCamion(camion: Camion, contexto: Pick<ContextoGestionCamiones, 'buscarMuellePorId'>): void {
    const muelle = contexto.buscarMuellePorId(camion.muelleId);
    if (!muelle) {
      throw new Error(`No existe el muelle ${camion.muelleId}`);
    }
    if (muelle.getCamionId()) {
      this.camionesEsperandoAcople.push(camion);
      return;
    }
    this.acoplarCamion(camion, muelle);
  }

  public camionesRegistrados(): Camion[] {
    return [...this.camiones.values()];
  }

  public liberarOrdenesDeCamionesPrevios(tickActual: number): void {
    for (const camion of this.camiones.values()) {
      if (camion.getEstado() === EstadoCamion.ACOPLADO && tickActual > camion.tickLlegada) {
        camion.liberarOrdenes();
      }
    }
  }

  public retirarCamionesCompletados(contexto: ContextoGestionCamiones): void {
    for (const camion of this.camiones.values()) {
      if (camion.estaRetirado() || !camion.todasLasOrdenesCompletadas()) continue;

      const muelle = contexto.buscarMuellePorId(camion.muelleId);
      if (!muelle || contexto.hayRobotEnCelda(muelle) || contexto.muelleOcupadoAlInicioDelTick(muelle)) continue;

      muelle.desacoplarCamion();
      camion.retirar();
    }
  }

  public acoplarCamionesEnEspera(contexto: Pick<ContextoGestionCamiones, 'buscarMuellePorId'>): void {
    for (let i = 0; i < this.camionesEsperandoAcople.length; i++) {
      const camion = this.camionesEsperandoAcople[i];
      const muelle = contexto.buscarMuellePorId(camion.muelleId);
      if (!muelle || muelle.getCamionId()) continue;

      this.acoplarCamion(camion, muelle);
      this.camionesEsperandoAcople.splice(i, 1);
      i--;
    }
  }

  private acoplarCamion(camion: Camion, muelle: Celda): void {
    muelle.acoplarCamion(camion.id);
    this.camiones.set(camion.id, camion);
  }
}
