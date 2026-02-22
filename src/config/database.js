// config/database.js

const dbConfig = {
  host: process.env.DB_HOST || 'up-de-fra1-postgresql-1.db.run-on-seenode.com',
  port: parseInt(process.env.DB_PORT) || 11550,
  database: process.env.DB_NAME || 'db_tbb569v84f9i',
  user: process.env.DB_USER || 'db_tbb569v84f9i',
  password: process.env.DB_PASSWORD || '1wt3wx6rgJxAT15QiduYkr7s',

  // Configuración SSL - CRÍTICO para Seenode
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        }
      : false,

  // Pool configuration
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,

  // Retry configuration
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 1000,
}

// Validar configuración mínima
const required = ['host', 'database', 'user', 'password']
const missing = required.filter((key) => !dbConfig[key])
if (missing.length > 0) {
  console.warn(`⚠️ Configuración incompleta: ${missing.join(', ')}`)
}

module.exports = dbConfig
