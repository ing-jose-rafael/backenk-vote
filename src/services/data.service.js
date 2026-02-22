// services/data.service.js
const fs = require('fs').promises
const path = require('path')
const databaseService = require('./database.service')

class DataService {
  constructor() {
    this.votantes = []
    this.indexPorCedula = new Map()
    this.votantesPorNombre = new Map() // Índice para búsqueda por nombre
    this.puestosCargados = false
    this.stats = {
      consultasLocales: 0,
      consultasBD: 0,
      cacheHits: 0,
    }
  }

  async initialize() {
    console.log('\n🚀 Inicializando servicio de datos...\n')

    // 1. Cargar votantes locales
    await this.cargarVotantesLocales()

    // 2. Intentar conectar a BD
    const dbConnected = await databaseService.connect()

    if (dbConnected) {
      console.log('✅ Base de datos disponible - consultas en tiempo real')
    } else {
      console.log('⚠️ Base de datos no disponible - solo datos locales')
    }
  }

  async cargarVotantesLocales() {
    try {
      const dataPath = path.join(__dirname, '..', 'votantes.json')
      const data = await fs.readFile(dataPath, 'utf-8')
      this.votantes = JSON.parse(data)

      // Crear índice por cédula
      this.indexPorCedula.clear()
      this.votantesPorNombre.clear()

      this.votantes.forEach((v) => {
        if (v.cedula) {
          this.indexPorCedula.set(v.cedula.trim(), v)
        }

        // Indexar por nombre para búsquedas rápidas
        if (v.nombreCompleto) {
          const nombreUpper = v.nombreCompleto.toUpperCase()
          if (!this.votantesPorNombre.has(nombreUpper)) {
            this.votantesPorNombre.set(nombreUpper, [])
          }
          this.votantesPorNombre.get(nombreUpper).push(v)
        }
      })

      console.log(`✅ Votantes locales: ${this.votantes.length} registros`)
      console.log(
        `   📍 Índice por cédula: ${this.indexPorCedula.size} entradas`,
      )
      console.log(
        `   📍 Índice por nombre: ${this.votantesPorNombre.size} términos\n`,
      )
    } catch (error) {
      console.error('❌ Error cargando votantes locales:', error.message)
      this.votantes = []
    }
  }

  /**
   * Busca votante por cédula (combina datos locales y BD)
   */
  async buscarPorCedula(cedula) {
    const cedulaLimpia = cedula.toString().trim()

    // 1. Buscar en datos locales
    const votanteLocal = this.indexPorCedula.get(cedulaLimpia)
    this.stats.consultasLocales++

    // 2. Buscar en BD (si está disponible)
    let puestoInfo = null
    if (databaseService.isConnected) {
      this.stats.consultasBD++
      puestoInfo = await databaseService.consultarCedula(cedulaLimpia)
      if (puestoInfo) {
        this.stats.cacheHits = databaseService.getStats().queries.cacheHits
      }
    }

    return {
      votante: votanteLocal || null,
      puestoVotacion: puestoInfo,
      fuente: {
        votante: votanteLocal ? 'local' : null,
        puesto: puestoInfo ? 'bd' : null,
      },
    }
  }

  /**
   * Busca votantes por nombre (solo en datos locales)
   */
  buscarPorNombre(texto) {
    const textoUpper = texto.toUpperCase().trim()

    if (textoUpper.length < 2) {
      return []
    }

    // Búsqueda en el índice (coincidencia exacta o parcial)
    const resultados = []

    // Método 1: Usar el índice para búsquedas exactas
    if (this.votantesPorNombre.has(textoUpper)) {
      resultados.push(...this.votantesPorNombre.get(textoUpper))
    }

    // Método 2: Búsqueda parcial para términos más largos
    if (textoUpper.length >= 3) {
      for (const [nombre, votantes] of this.votantesPorNombre.entries()) {
        if (nombre.includes(textoUpper) && nombre !== textoUpper) {
          resultados.push(...votantes)
        }
      }
    }

    // Método 3: Búsqueda en array completo para coincidencias parciales
    // (solo si las anteriores no dieron suficientes resultados)
    if (resultados.length < 10) {
      const resultadosParciales = this.votantes.filter(
        (v) =>
          v.nombreCompleto &&
          v.nombreCompleto.toUpperCase().includes(textoUpper) &&
          !resultados.includes(v),
      )
      resultados.push(...resultadosParciales)
    }

    // Eliminar duplicados (por si acaso)
    const unicos = []
    const seen = new Set()
    for (const v of resultados) {
      if (!seen.has(v.cedula)) {
        seen.add(v.cedula)
        unicos.push(v)
      }
    }

    return unicos
  }

  /**
   * Obtiene estadísticas básicas
   */
  getEstadisticasBasicas() {
    const porGrupo = {}
    const porBarrio = {}
    const porGenero = { M: 0, F: 0, sin_dato: 0 }

    this.votantes.forEach((v) => {
      const grupo = v.grupo || 'Sin grupo'
      porGrupo[grupo] = (porGrupo[grupo] || 0) + 1

      const barrio = v.barrio || 'Sin barrio'
      porBarrio[barrio] = (porBarrio[barrio] || 0) + 1

      if (v.genero === 'M') porGenero.M++
      else if (v.genero === 'F') porGenero.F++
      else porGenero.sin_dato++
    })

    return {
      totalVotantes: this.votantes.length,
      porGrupo,
      porBarrio,
      porGenero,
    }
  }

  /**
   * Obtiene estadísticas avanzadas
   */
  getEstadisticasAvanzadas() {
    // Análisis de duplicados
    const cedulasCount = {}
    const votantesPorCedula = {}

    this.votantes.forEach((v) => {
      if (!v.cedula) return
      const cedula = v.cedula.trim()

      if (!cedulasCount[cedula]) {
        cedulasCount[cedula] = 0
        votantesPorCedula[cedula] = []
      }
      cedulasCount[cedula]++
      votantesPorCedula[cedula].push(v)
    })

    // Procesar duplicados
    const duplicados = Object.entries(cedulasCount)
      .filter(([cedula, count]) => count > 1 && cedula !== 'nan')
      .map(([cedula, count]) => ({
        cedula,
        repeticiones: count,
        votantes: votantesPorCedula[cedula].map((v) => ({
          nombreCompleto: v.nombreCompleto,
          coordinador: v.coordinador,
          barrio: v.barrio,
        })),
      }))
      .sort((a, b) => b.repeticiones - a.repeticiones)

    // Top coordinadores
    const coordinadoresCount = {}
    this.votantes.forEach((v) => {
      const coord = v.coordinador || 'Sin coordinador'
      coordinadoresCount[coord] = (coordinadoresCount[coord] || 0) + 1
    })

    const topCoordinadores = Object.entries(coordinadoresCount)
      .map(([coordinador, cantidad]) => ({ coordinador, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    // Top barrios
    const barriosCount = {}
    this.votantes.forEach((v) => {
      const barrio = v.barrio || 'Sin barrio'
      barriosCount[barrio] = (barriosCount[barrio] || 0) + 1
    })

    const topBarrios = Object.entries(barriosCount)
      .map(([barrio, cantidad]) => ({ barrio, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    return {
      resumen: {
        totalVotantes: this.votantes.length,
        cedulasUnicas: Object.keys(cedulasCount).length,
        totalDuplicados: duplicados.length,
        votantesDuplicados: duplicados.reduce(
          (sum, d) => sum + d.repeticiones,
          0,
        ),
      },
      duplicados: duplicados.slice(0, 20),
      topCoordinadores,
      topBarrios,
    }
  }

  /**
   * Obtiene estado completo del servicio
   */
  getStatus() {
    return {
      initialized: true,
      votantesLocales: this.votantes.length,
      puestosCargados: this.puestosCargados,
      dbStatus: databaseService.getStats(),
      consultas: { ...this.stats },
    }
  }
}

module.exports = new DataService()
