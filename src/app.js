const express = require('express')
const votantesRouter = require('./routes/votantes')

const app = express()
const cors = require('cors')
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// CORS básico
// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type");
//   if (req.method === "OPTIONS") return res.sendStatus(200);
//   next();
// });
// Configuración CORS más específica
app.use(
  cors({
    origin: '*', // Origen específico de tu frontend
    credentials: true, // Si usas cookies/sesiones
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Agrega 'Authorization' aquí
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

// Rutas
app.use('/api', votantesRouter)

// Health check (público)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

// Error handler global
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`\n✅  API Votantes corriendo en http://localhost:${PORT}\n`)
  console.log(`   📌 PÚBLICAS (sin token):`)
  console.log(`      POST /api/auth/login`)
  console.log(`      GET  /api/health\n`)
  console.log(`   🔒 PROTEGIDAS (requieren token):`)
  console.log(`      POST /api/auth/logout`)
  console.log(`      GET  /api/votantes/cedula/:numero`)
  console.log(`      GET  /api/votantes/nombre/:texto`)
  console.log(`      GET  /api/votantes/stats\n`)
  console.log(`   👑 ADMIN (solo usuario admin):`)
  console.log(`      GET  /api/votantes/stats/avanzadas`)
  console.log(`      GET  /api/auditoria\n`)
})

module.exports = app
