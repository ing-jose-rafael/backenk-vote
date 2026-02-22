// app.js

const express = require('express')
const cors = require('cors')
const votantesRouter = require('./routes/votantes')
const dataService = require('./services/data.service')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// Configuración CORS
app.use(
  cors({
    origin: '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

// Middleware para logging de peticiones (opcional, útil para debugging)
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url} - ${new Date().toISOString()}`)
  next()
})

// Inicialización de servicios
async function initializeApp() {
  try {
    console.log('\n🚀 Inicializando aplicación...\n')

    // Inicializar el servicio de datos (carga votantes locales y conecta a BD)
    await dataService.initialize()

    // Mostrar estado de la aplicación
    const status = dataService.getStatus()

    console.log('\n📊 Estado de la aplicación:')
    console.log(`   📍 Votantes locales: ${status.votantesLocales} registros`)
    console.log(
      `   📍 Base de datos: ${status.dbStatus.isConnected ? '✅ Conectada' : '❌ Desconectada'}`,
    )

    if (status.puestosCargados) {
      console.log(
        `   📍 Puestos de votación: ${status.totalPuestos} registros (desde BD)`,
      )
    } else {
      console.log(`   📍 Puestos de votación: ⚠️ No disponibles (modo local)`)
    }

    console.log('\n✅ Aplicación inicializada correctamente\n')
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error.message)
    console.warn(
      '⚠️ La aplicación continuará en modo limitado (solo datos locales)',
    )
  }
}

// Ejecutar inicialización (no bloquea el inicio del servidor)
initializeApp()

// Rutas de la API
app.use('/api', votantesRouter)

// Health check mejorado
app.get('/api/health', (req, res) => {
  const status = dataService.getStatus()

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: status.dbStatus.isConnected ? 'connected' : 'disconnected',
      votantes: status.votantesLocales,
      puestos: status.puestosCargados ? status.totalPuestos : 0,
    },
  })
})

// Endpoint para verificar el estado de la base de datos (útil para monitoreo)
app.get('/api/db-status', async (req, res) => {
  const status = dataService.getStatus()

  res.json({
    timestamp: new Date().toISOString(),
    database: {
      connected: status.dbStatus.isConnected,
      totalConnections: status.dbStatus.totalConnections,
      idleConnections: status.dbStatus.idleConnections,
    },
    data: {
      votantesLocales: status.votantesLocales,
      puestosCargados: status.puestosCargados,
      totalPuestos: status.totalPuestos,
    },
  })
})

// Endpoint para verificar la tabla específica
app.get('/api/check-table', async (req, res) => {
  try {
    const dbService = require('./services/database.service')
    const existe = await dbService.verificarTabla()

    // Probar una consulta de ejemplo
    let prueba = null
    if (existe) {
      const resultado = await dbService.consultarCedula('1046346406')
      prueba = resultado ? '✅ Funciona' : '❌ No devuelve datos'
    }

    res.json({
      timestamp: new Date().toISOString(),
      database: {
        connected: dbService.isConnected,
        stats: dbService.getStats(),
      },
      tabla: {
        existe: existe,
        nombre: 'Atlantico_Oct2023',
        prueba: prueba,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    })
  }
})

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `No se encontró la ruta ${req.method} ${req.url}`,
  })
})

// Error handler global mejorado
app.use((err, req, res, next) => {
  console.error('❌ Error interno:', err.stack)

  // Determinar el tipo de error
  let statusCode = 500
  let errorMessage = 'Error interno del servidor'

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    errorMessage = 'Token inválido'
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    errorMessage = 'Token expirado'
  } else if (err.code === 'ECONNREFUSED') {
    errorMessage = 'Error de conexión con la base de datos'
  } else if (err.message.includes('no pg_hba.conf')) {
    errorMessage = 'Error de autenticación con la base de datos (SSL requerido)'
  }

  res.status(statusCode).json({
    error: errorMessage,
    timestamp: new Date().toISOString(),
  })
})

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅  API Votantes corriendo en http://localhost:${PORT}`)
  console.log(`${'═'.repeat(60)}\n`)

  console.log('   📌 ENDPOINTS PÚBLICOS (sin token):')
  console.log(`      POST   http://localhost:${PORT}/api/auth/login`)
  console.log(`      GET    http://localhost:${PORT}/api/health`)
  console.log(`      GET    http://localhost:${PORT}/api/db-status\n`)

  console.log('   🔒 ENDPOINTS PROTEGIDOS (requieren token):')
  console.log(`      POST   http://localhost:${PORT}/api/auth/logout`)
  console.log(
    `      GET    http://localhost:${PORT}/api/votantes/cedula/:numero`,
  )
  console.log(
    `      GET    http://localhost:${PORT}/api/votantes/nombre/:texto`,
  )
  console.log(`      GET    http://localhost:${PORT}/api/votantes/stats\n`)

  console.log('   👑 ENDPOINTS ADMIN (solo usuario admin):')
  console.log(
    `      GET    http://localhost:${PORT}/api/votantes/stats/avanzadas`,
  )
  console.log(`      GET    http://localhost:${PORT}/api/auditoria\n`)

  console.log('   📊 EJEMPLOS DE CONSULTA:')
  console.log(
    `      GET    http://localhost:${PORT}/api/votantes/cedula/1046346406`,
  )
  console.log(`      GET    http://localhost:${PORT}/api/votantes/nombre/JOHN`)
  console.log(`      GET    http://localhost:${PORT}/api/votantes/stats`)
  console.log(
    `      GET    http://localhost:${PORT}/api/votantes/stats/avanzadas`,
  )
  console.log(
    `      GET    http://localhost:${PORT}/api/auditoria?coordinadorId=orlando.polo\n`,
  )

  console.log('   👤 USUARIOS DE PRUEBA:')
  console.log(`      admin / admin2026`)
  console.log(`      orlando.polo / orlandopolo2026`)
  console.log(`      robinson.villa / robinsonvilla2026`)
  console.log(`      urbano.ortiz / urbanoortiz2026\n`)
})

// Manejo graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal SIGTERM. Cerrando servidor...')
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal SIGINT. Cerrando servidor...')
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente')
    process.exit(0)
  })
})

module.exports = app
