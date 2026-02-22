// routes/votantes.js
const express = require('express')
const router = express.Router()
const dataService = require('../services/data.service')
const {
  validarCredenciales,
  generarToken,
  autenticar,
  soloAdmin,
} = require('../middleware/auth')
const {
  registrarConsulta,
  obtenerRegistros,
} = require('../middleware/auditoria')

// ═══════════════════════════════════════════════════════════════
//  RUTAS PÚBLICAS  (sin token)
// ═══════════════════════════════════════════════════════════════

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({
      error: 'Se requieren username y password en el body.',
    })
  }

  const usuario = validarCredenciales(username.trim(), password.trim())

  if (!usuario) {
    return res.status(401).json({
      error: 'Credenciales incorrectas.',
    })
  }

  const token = generarToken(usuario)

  res.json({
    success: true,
    mensaje: `Bienvenido, ${usuario.nombreCoordinador}`,
    data: {
      token,
      usuario: {
        id: usuario.id,
        nombreCoordinador: usuario.nombreCoordinador,
        rol: usuario.rol,
      },
    },
  })
})

router.post('/auth/logout', autenticar, (req, res) => {
  res.json({
    success: true,
    mensaje: `Sesión cerrada para ${req.usuario.nombreCoordinador}.`,
  })
})

// ═══════════════════════════════════════════════════════════════
//  RUTAS PROTEGIDAS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/votantes/cedula/:numero
 * Busca en votantes locales Y en base de datos PostgreSQL
 */
router.get('/votantes/cedula/:numero', autenticar, async (req, res) => {
  const cedula = req.params.numero.trim()

  if (!cedula || !/^\d+$/.test(cedula)) {
    return res.status(400).json({
      error: 'Cédula inválida. Solo se permiten números.',
    })
  }

  try {
    // Buscar en datos locales y BD
    const resultado = await dataService.buscarPorCedula(cedula)

    // Registrar en auditoría
    registrarConsulta({
      coordinador: req.usuario,
      tipoConsulta: 'cedula',
      parametro: cedula,
      resultadoEncontrado: !!resultado.votante,
    })

    // Construir mensaje según fuente
    let mensaje = ''
    if (resultado.votante && resultado.puestoVotacion) {
      mensaje = 'Votante encontrado en base local y puesto en BD'
    } else if (resultado.votante) {
      mensaje = 'Votante encontrado solo en base local'
    } else if (resultado.puestoVotacion) {
      mensaje = 'Votante no registrado, pero tiene puesto de votación'
    } else {
      return res.status(404).json({
        error: 'No se encontró información para esta cédula',
        cedula,
      })
    }

    res.json({
      success: true,
      data: resultado.votante || null,
      puestoVotacion: resultado.puestoVotacion,
      fuente: resultado.fuente,
      mensaje,
    })
  } catch (error) {
    console.error('❌ Error en búsqueda por cédula:', error)
    res.status(500).json({
      error: 'Error interno al buscar la cédula',
    })
  }
})

/**
 * GET /api/votantes/nombre/:texto
 * Búsqueda por nombre (solo datos locales)
 */
router.get('/votantes/nombre/:texto', autenticar, (req, res) => {
  const texto = req.params.texto.trim().toUpperCase()

  if (!texto || texto.length < 2) {
    return res.status(400).json({
      error: 'El texto de búsqueda debe tener al menos 2 caracteres.',
    })
  }

  const resultados = dataService.buscarPorNombre(texto)
  const encontrado = resultados.length > 0

  registrarConsulta({
    coordinador: req.usuario,
    tipoConsulta: 'nombre',
    parametro: texto,
    resultadoEncontrado: encontrado,
  })

  if (!encontrado) {
    return res.status(404).json({
      error: 'No se encontraron votantes con ese nombre.',
      busqueda: texto,
    })
  }

  res.json({
    success: true,
    total: resultados.length,
    data: resultados,
  })
})

/**
 * GET /api/votantes/stats
 * Estadísticas básicas
 */
router.get('/votantes/stats', autenticar, (req, res) => {
  const stats = dataService.getEstadisticasBasicas()
  const status = dataService.getStatus()

  res.json({
    success: true,
    data: {
      ...stats,
      dbConectada: status.dbStatus.isConnected,
      cacheSize: status.dbStatus.cache.size,
    },
  })
})

/**
 * GET /api/votantes/stats/avanzadas (solo admin)
 */
router.get('/votantes/stats/avanzadas', autenticar, soloAdmin, (req, res) => {
  const stats = dataService.getEstadisticasAvanzadas()
  const status = dataService.getStatus()

  res.json({
    success: true,
    data: {
      ...stats,
      dbStatus: {
        conectada: status.dbStatus.isConnected,
        consultas: status.dbStatus.queries,
        cache: status.dbStatus.cache,
      },
      rendimiento: status.consultas,
    },
  })
})

/**
 * GET /api/auditoria (solo admin)
 */
router.get('/auditoria', autenticar, soloAdmin, (req, res) => {
  const filtros = {
    coordinadorId: req.query.coordinadorId || null,
    desde: req.query.desde || null,
    hasta: req.query.hasta || null,
  }

  const registros = obtenerRegistros(filtros)

  res.json({
    success: true,
    total: registros.length,
    filtros,
    data: registros,
  })
})

module.exports = router
