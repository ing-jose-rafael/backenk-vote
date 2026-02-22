// services/database.service.js
const { Pool } = require('pg')
const dbConfig = require('../config/database')

class DatabaseService {
  constructor() {
    this.pool = null
    this.isConnected = false
    this.retryCount = 0
    this.maxRetries = dbConfig.retryAttempts
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

      // Probar conexión
      await this.testConnection()

      this.isConnected = true
      this.retryCount = 0
      console.log('✅ Conexión a PostgreSQL establecida')

      this.setupEventHandlers()
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
      console.error('     3. Verifica que tu IP sea:', this.getPublicIP())
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

  getPublicIP() {
    // Intenta obtener IP pública (opcional)
    return '8.243.64.201' // La IP de tu error
  }

  async getPuestosVotacion() {
    if (!this.isConnected) {
      throw new Error('Base de datos no disponible')
    }

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
        FROM Atlantico_Oct2023
      `
      const result = await this.pool.query(query)
      return result.rows
    } catch (error) {
      console.error('❌ Error en consulta:', error.message)
      return []
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      totalConnections: this.pool?.totalCount || 0,
      idleConnections: this.pool?.idleCount || 0,
    }
  }
}

module.exports = new DatabaseService()
