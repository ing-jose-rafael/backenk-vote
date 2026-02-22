// data/loader.js - Adaptador para mantener compatibilidad con código existente
const dataService = require('../services/data.service')

// Inicializar automáticamente (no blocking)
dataService.initialize().catch(console.error)

module.exports = {
  // Votantes (mantener propiedades para compatibilidad)
  get votantes() {
    return dataService.votantes
  },
  get indexPorCedula() {
    return dataService.indexPorCedula
  },
  get total() {
    return dataService.votantes.length
  },

  // Puestos de votación (ya no se cargan todos en memoria)
  get puestosVotacion() {
    return new Map()
  }, // Vacío, se consulta individualmente
  get puestosCargados() {
    return dataService.getStatus().dbStatus.isConnected
  },

  // Métodos (adaptados para mantener compatibilidad)
  cargarPuestosDesdeDB: async () => {
    console.log('ℹ️ Los puestos se consultan individualmente bajo demanda')
    return true
  },

  getStatus: () => dataService.getStatus(),

  // Nuevo método para buscar por cédula (para compatibilidad)
  buscarPorCedula: (cedula) => dataService.buscarPorCedula(cedula),
}
