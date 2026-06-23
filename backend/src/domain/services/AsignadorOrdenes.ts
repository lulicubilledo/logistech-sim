import { TipoCamion } from '../enums/TipoCamion';
import { Camion } from '../entities/Camion';
import { Celda } from '../entities/Celda';
import { Orden } from '../entities/Orden';
import { AsignacionRobot } from '../entities/Robot';
import { PriorizadorOrdenes } from './PriorizadorOrdenes';

export interface ContextoAsignacionOrdenes {
  camiones: Camion[];
  buscarMuellePorId(id: string): Celda | null;
  estanterias(): Celda[];
}

export class AsignadorOrdenes {
  constructor(private readonly priorizadorOrdenes = new PriorizadorOrdenes()) {}

  public proximaAsignacionDisponible(contexto: ContextoAsignacionOrdenes): AsignacionRobot | null {
    const ordenesPriorizadas = this.ordenesDisponibles(contexto.camiones)
      .sort((a, b) => this.priorizadorOrdenes.comparar(a, b));

    for (const orden of ordenesPriorizadas) {
      if (this.hayOrdenDeDespachoMasPrioritariaPendiente(orden, contexto.camiones)) continue;

      const asignacion = this.crearAsignacionParaOrden(orden, contexto);
      if (asignacion) return asignacion;
    }

    return null;
  }

  private ordenesDisponibles(camiones: Camion[]): Orden[] {
    return camiones
      .filter((camion) => camion.tieneOrdenesLiberadas())
      .flatMap((camion) => camion.ordenes)
      .filter((orden) => !orden.estaCompletada() && !orden.estaAsignada());
  }

  private crearAsignacionParaOrden(orden: Orden, contexto: ContextoAsignacionOrdenes): AsignacionRobot | null {
    const camion = contexto.camiones.find((camionActual) => camionActual.id === orden.camionId);
    if (!camion || camion.estaRetirado()) return null;

    const muelle = contexto.buscarMuellePorId(camion.muelleId);
    if (!muelle) return null;

    if (orden.tipoCamion === TipoCamion.RECEPCION) {
      const estanteria = contexto.estanterias().find((celda) => celda.estaDisponibleParaAlmacenar());
      if (!estanteria) return null;
      return { orden, origen: muelle, destino: estanteria };
    }

    const estanteriaConPaquete = contexto.estanterias().find((celda) => {
      const paquete = celda.getPaquete();
      return paquete?.id === orden.paquete.id && !celda.estaReservada();
    });

    if (!estanteriaConPaquete || muelle.estaReservada()) return null;
    return { orden, origen: estanteriaConPaquete, destino: muelle };
  }

  private hayOrdenDeDespachoMasPrioritariaPendiente(orden: Orden, camiones: Camion[]): boolean {
    if (orden.tipoCamion !== TipoCamion.DESPACHO) return false;

    const camion = camiones.find((camionActual) => camionActual.id === orden.camionId);
    if (!camion) return false;

    return this.priorizadorOrdenes.hayOrdenDeDespachoMasPrioritariaPendiente(orden, camion.ordenes);
  }
}
