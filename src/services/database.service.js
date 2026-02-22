// services/database.service.js
const { Pool } = require('pg')
const dbConfig = require('../config/database')

class DatabaseService {
  constructor() {
    this.pool = null
    this.isConnected = false
    this.retryCount = 0
    this.maxRetries = dbConfig.retryAttempts
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      cacheHits: 0,
    }

    // Cache simple para consultas repetidas (opcional)
    this.cache = new Map()
    this.cacheEnabled = true
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutos
  }

  async connect() {
    try {
      this.pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl,
        max: dbConfig.max,
        idleTimeoutMillis: dbConfig.idleTimeoutMillis,
        connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
      })

      await this.testConnection()

      this.isConnected = true
      this.retryCount = 0
      console.log('✅ Conexión a PostgreSQL establecida')

      this.setupEventHandlers()

      // Limpiar caché cada cierto tiempo
      if (this.cacheEnabled) {
        setInterval(() => this.cleanCache(), this.cacheTimeout)
      }

      return true
    } catch (error) {
      return this.handleConnectionError(error)
    }
  }

  async testConnection() {
    const client = await this.pool.connect()
    try {
      await client.query('SELECT 1')
      console.log('✅ Test de conexión exitoso')
    } finally {
      client.release()
    }
  }

  setupEventHandlers() {
    this.pool.on('error', (err) => {
      console.error('❌ Error inesperado en el pool:', err)
      this.isConnected = false
    })

    this.pool.on('connect', () => {
      console.log('🔌 Nueva conexión establecida')
    })

    this.pool.on('remove', () => {
      console.log('🔌 Conexión removida del pool')
    })
  }

  handleConnectionError(error) {
    console.error(
      `❌ Error de conexión (intento ${this.retryCount + 1}/${this.maxRetries})`,
    )

    if (error.code === '28P01') {
      console.error('   Error de autenticación: Verifica usuario y contraseña')
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Error: Servidor rechazó la conexión')
    } else if (error.message.includes('no pg_hba.conf entry')) {
      console.error('   Error de permisos: IP no autorizada o SSL requerido')
      console.error('   Solución:')
      console.error('     1. Habilita SSL en la conexión (DB_SSL=true)')
      console.error('     2. Agrega tu IP al whitelist en Seenode')
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   Error: Timeout de conexión')
    }

    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      console.log(`⏳ Reintentando en ${dbConfig.retryDelay}ms...`)
      return new Promise((resolve) =>
        setTimeout(resolve, dbConfig.retryDelay),
      ).then(() => this.connect())
    }

    console.warn('⚠️ Usando solo datos locales (BD no disponible)')
    return false
  }

  /**
   * Consulta una cédula específica en la base de datos
   * @param {string} cedula - Número de cédula a consultar
   * @returns {Promise<Object|null>} - Datos del puesto de votación o null
   */
  async consultarCedula(cedula) {
    if (!this.isConnected) {
      this.stats.failedQueries++
      return null
    }

    // Limpiar cédula (eliminar espacios, puntos, etc.)
    const cedulaLimpia = cedula.toString().trim()

    // Verificar caché primero
    if (this.cacheEnabled && this.cache.has(cedulaLimpia)) {
      const cached = this.cache.get(cedulaLimpia)
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.stats.cacheHits++
        return cached.data
      } else {
        this.cache.delete(cedulaLimpia) // Cache expirado
      }
    }

    this.stats.totalQueries++

    try {
      const query = `
        SELECT 
          cedula,
          departamento,
          municipio,
          zona,
          puesto_votacion,
          direccion_puesto_votacion,
          mesa
        FROM "Atlantico_Oct2023"
        WHERE cedula = $1
        LIMIT 1
      `

      const result = await this.pool.query(query, [cedulaLimpia])

      this.stats.successfulQueries++

      if (result.rows.length > 0) {
        const puestoInfo = {
          departamento: result.rows[0].departamento || '',
          municipio: result.rows[0].municipio || '',
          zona: result.rows[0].zona || '',
          puestoVotacion: result.rows[0].puesto_votacion || '',
          direccionPuesto: result.rows[0].direccion_puesto_votacion || '',
          mesa: result.rows[0].mesa || '',
        }

        // Guardar en caché
        if (this.cacheEnabled) {
          this.cache.set(cedulaLimpia, {
            data: puestoInfo,
            timestamp: Date.now(),
          })
        }

        return puestoInfo
      }

      return null
    } catch (error) {
      this.stats.failedQueries++
      console.error(`❌ Error consultando cédula ${cedula}:`, error.message)
      return null
    }
  }

  /**
   * Consulta múltiples cédulas (útil para búsquedas por nombre)
   * @param {Array<string>} cedulas - Lista de cédulas
   * @returns {Promise<Map>} - Mapa de cédulas a datos
   */
  async consultarMultiplesCedulas(cedulas) {
    if (!this.isConnected || cedulas.length === 0) {
      return new Map()
    }

    // Filtrar cédulas no vacías y únicas
    const cedulasUnicas = [...new Set(cedulas.filter((c) => c && c.trim()))]

    if (cedulasUnicas.length === 0) return new Map()

    try {
      // Crear placeholders ($1, $2, $3, ...)
      const placeholders = cedulasUnicas.map((_, i) => `$${i + 1}`).join(',')

      const query = `
        SELECT 
          cedula,
          departamento,
          municipio,
          zona,
          puesto_votacion,
          direccion_puesto_votacion,
          mesa
        FROM "Atlantico_Oct2023"
        WHERE cedula IN (${placeholders})
      `

      const result = await this.pool.query(query, cedulasUnicas)

      const mapa = new Map()
      result.rows.forEach((row) => {
        mapa.set(row.cedula.toString().trim(), {
          departamento: row.departamento || '',
          municipio: row.municipio || '',
          zona: row.zona || '',
          puestoVotacion: row.puesto_votacion || '',
          direccionPuesto: row.direccion_puesto_votacion || '',
          mesa: row.mesa || '',
        })
      })

      return mapa
    } catch (error) {
      console.error('❌ Error consultando múltiples cédulas:', error.message)
      return new Map()
    }
  }

  /**
   * Limpia el caché expirado
   */
  cleanCache() {
    const now = Date.now()
    let deleted = 0

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key)
        deleted++
      }
    }

    if (deleted > 0) {
      console.log(`🧹 Caché limpiado: ${deleted} entradas eliminadas`)
    }
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      pool: {
        total: this.pool?.totalCount || 0,
        idle: this.pool?.idleCount || 0,
        waiting: this.pool?.waitingCount || 0,
      },
      queries: { ...this.stats },
      cache: {
        enabled: this.cacheEnabled,
        size: this.cache.size,
        timeout: this.cacheTimeout,
      },
    }
  }

  /**
   * Desconecta el pool
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end()
      this.isConnected = false
      console.log('👋 Desconectado de PostgreSQL')
    }
  }
}

module.exports = new DatabaseService()
