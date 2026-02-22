// services/data.service.js
const fs = require('fs').promises
const path = require('path')
const databaseService = require('./database.service')

class DataService {
  constructor() {
    this.votantes = []
    this.indexPorCedula = new Map()
    this.puestosVotacion = new Map()
    this.puestosCargados = false
  }

  async initialize() {
    // 1. Siempre cargar datos locales
    await this.cargarVotantesLocales()

    // 2. Intentar conectar a BD
    const dbConnected = await databaseService.connect()

    if (dbConnected) {
      await this.cargarPuestosDesdeDB()
    }
  }

  async cargarVotantesLocales() {
    try {
      const dataPath = path.join(__dirname, '..', 'votantes.json')
      const data = await fs.readFile(dataPath, 'utf-8')
      this.votantes = JSON.parse(data)

      this.indexPorCedula.clear()
      this.votantes.forEach((v) => {
        if (v.cedula) {
          this.indexPorCedula.set(v.cedula.trim(), v)
        }
      })

      console.log(`✅ Votantes locales: ${this.votantes.length} registros`)
    } catch (error) {
      console.error('❌ Error cargando votantes:', error.message)
      this.votantes = []
    }
  }

  async cargarPuestosDesdeDB() {
    try {
      const puestosArray = await databaseService.getPuestosVotacion()

      if (puestosArray.length > 0) {
        this.puestosVotacion.clear()
        puestosArray.forEach((record) => {
          if (record.cedula) {
            const cedula = record.cedula.toString().trim()
            this.puestosVotacion.set(cedula, {
              departamento: record.departamento || '',
              municipio: record.municipio || '',
              zona: record.zona || '',
              puestoVotacion: record.puesto_votacion || '',
              direccionPuesto: record.direccion_puesto_votacion || '',
              mesa: record.mesa || '',
            })
          }
        })

        this.puestosCargados = true
        console.log(`✅ Puestos BD: ${this.puestosVotacion.size} registros`)
      }
    } catch (error) {
      console.error('❌ Error cargando puestos:', error.message)
    }
  }

  buscarPorCedula(cedula) {
    return {
      votante: this.indexPorCedula.get(cedula) || null,
      puestoVotacion: this.puestosCargados
        ? this.puestosVotacion.get(cedula)
        : null,
    }
  }

  getStatus() {
    return {
      votantesLocales: this.votantes.length,
      puestosCargados: this.puestosCargados,
      totalPuestos: this.puestosVotacion.size,
      dbStatus: databaseService.getStatus(),
    }
  }
}

module.exports = new DataService()
