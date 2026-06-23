import { TipoCamion } from '../enums/TipoCamion';
import { Orden } from '../entities/Orden';

export class PriorizadorOrdenes {
  public comparar(a: Orden, b: Orden): number {
    const paqueteA = a.paquete;
    const paqueteB = b.paquete;

    if (paqueteA.esComestible() && !paqueteB.esComestible()) return -1;
    if (!paqueteA.esComestible() && paqueteB.esComestible()) return 1;

    if (paqueteA.esComestible() && paqueteB.esComestible()) {
      const vencA = paqueteA.vencimiento?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const vencB = paqueteB.vencimiento?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return vencA - vencB;
    }

    return paqueteB.peso - paqueteA.peso;
  }

  public hayOrdenDeDespachoMasPrioritariaPendiente(orden: Orden, ordenesDelMismoCamion: Orden[]): boolean {
    if (orden.tipoCamion !== TipoCamion.DESPACHO) return false;

    return ordenesDelMismoCamion.some((otraOrden) => {
      if (otraOrden === orden || otraOrden.tipoCamion !== TipoCamion.DESPACHO) return false;
      if (otraOrden.estaCompletada()) return false;
      return this.comparar(otraOrden, orden) < 0;
    });
  }
}
