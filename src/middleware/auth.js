const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-votantes-2024'

// ── Cargar usuarios una vez al arranque ──────────────────────
const usersPath = path.join(__dirname, '..', 'data', 'usuarios.json')
const usuarios = JSON.parse(fs.readFileSync(usersPath, 'utf-8'))

// Indexar por id para búsqueda rápida
const usuariosPorId = new Map()
usuarios.forEach((u) => usuariosPorId.set(u.id, u))

// ── Generar token ────────────────────────────────────────────
function generarToken(usuario) {
  return jwt.sign(
    {
      usuarioId: usuario.id,
      nombreCoordinador: usuario.nombreCoordinador,
      rol: usuario.rol,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  )
}

// ── Validar credenciales ─────────────────────────────────────
function validarCredenciales(username, password) {
  const usuario = usuariosPorId.get(username)
  if (!usuario) return null
  if (usuario.password !== password) return null
  return usuario
}

// ── Middleware: verificar token en header Authorization ───────
// Uso: Authorization: Bearer <token>
function autenticar(req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error:
        'Se requiere autenticación. Envía el token en el header Authorization: Bearer <token>',
    })
  }

  const token = header.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.usuario = {
      id: decoded.usuarioId,
      nombreCoordinador: decoded.nombreCoordinador,
      rol: decoded.rol,
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' })
  }
}

// ── Middleware: solo admin ────────────────────────────────────
function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Solo el administrador puede realizar esta acción.' })
  }
  next()
}

module.exports = {
  validarCredenciales,
  generarToken,
  autenticar,
  soloAdmin,
}
