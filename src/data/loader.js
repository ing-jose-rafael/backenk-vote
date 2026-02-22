// data/loader.js - Adaptador para mantener compatibilidad
const dataService = require('../services/data.service')

// Inicializar automáticamente
dataService.initialize().catch(console.error)

module.exports = {
  // Votantes
  get votantes() {
    return dataService.votantes
  },
  get indexPorCedula() {
    return dataService.indexPorCedula
  },
  get total() {
    return dataService.votantes.length
  },

  // Puestos
  get puestosVotacion() {
    return dataService.puestosVotacion
  },
  get puestosCargados() {
    return dataService.puestosCargados
  },

  // Métodos
  cargarPuestosDesdeDB: () => dataService.cargarPuestosDesdeDB(),
  getStatus: () => dataService.getStatus(),
}
