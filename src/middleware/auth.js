const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ── Cargar usuarios una vez al arranque ──────────────────────
const usersPath = path.join(__dirname, "..", "data", "usuarios.json");
const usuarios = JSON.parse(fs.readFileSync(usersPath, "utf-8"));

// Indexar por id para búsqueda rápida
const usuariosPorId = new Map();
usuarios.forEach((u) => usuariosPorId.set(u.id, u));

// ── Token store en memoria ───────────────────────────────────
// Map:  token  →  { usuarioId, nombreCoordinador, rol, createdAt }
const tokensActivos = new Map();
const TOKEN_DURACION_MS = 1000 * 60 * 60 * 4; // 4 horas

// ── Generar token ────────────────────────────────────────────
function generarToken(usuario) {
  const token = crypto.randomBytes(32).toString("hex");
  tokensActivos.set(token, {
    usuarioId: usuario.id,
    nombreCoordinador: usuario.nombreCoordinador,
    rol: usuario.rol,
    createdAt: Date.now(),
  });
  return token;
}

// ── Validar credenciales ─────────────────────────────────────
function validarCredenciales(username, password) {
  const usuario = usuariosPorId.get(username);
  if (!usuario) return null;
  if (usuario.password !== password) return null;
  return usuario;
}

// ── Middleware: verificar token en header Authorization ───────
// Uso: Authorization: Bearer <token>
function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Se requiere autenticación. Envía el token en el header Authorization: Bearer <token>",
    });
  }

  const token = header.split(" ")[1];
  const sesion = tokensActivos.get(token);

  if (!sesion) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }

  // Verificar expiración
  if (Date.now() - sesion.createdAt > TOKEN_DURACION_MS) {
    tokensActivos.delete(token);
    return res.status(401).json({ error: "Token expirado. Inicia sesión de nuevo." });
  }

  // Agregar datos del usuario al request
  req.usuario = {
    id: sesion.usuarioId,
    nombreCoordinador: sesion.nombreCoordinador,
    rol: sesion.rol,
  };

  next();
}

// ── Middleware: solo admin ────────────────────────────────────
function soloAdmin(req, res, next) {
  if (req.usuario.rol !== "admin") {
    return res.status(403).json({ error: "Solo el administrador puede realizar esta acción." });
  }
  next();
}

// ── Logout: eliminar token ────────────────────────────────────
function invalidarToken(token) {
  tokensActivos.delete(token);
}

module.exports = {
  validarCredenciales,
  generarToken,
  autenticar,
  soloAdmin,
  invalidarToken,
};
