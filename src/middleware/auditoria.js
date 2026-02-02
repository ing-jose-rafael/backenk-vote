const path = require('path')
const fs = require('fs')

const AUDIT_PATH = path.join(__dirname, '..', 'data', 'auditoria.json')

// ── Cargar registros previos si existen ───────────────────────
let registros = []
if (fs.existsSync(AUDIT_PATH)) {
  try {
    registros = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf-8'))
  } catch (e) {
    registros = []
  }
}

// ── Guardar en disco ──────────────────────────────────────────
function persistir() {
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(registros, null, 2), 'utf-8')
}

// ── Registrar una consulta ────────────────────────────────────
function registrarConsulta({
  coordinador,
  tipoConsulta,
  parametro,
  resultadoEncontrado,
}) {
  const entrada = {
    id: registros.length + 1,
    fecha: new Date().toISOString(),
    coordinador, // { id, nombreCoordinador, rol }
    tipoConsulta, // "cedula" | "nombre"
    parametro, // valor buscado
    resultadoEncontrado, // true / false
  }

  registros.push(entrada)
  //persistir()
  return entrada
}

// ── Obtener todos los registros ───────────────────────────────
function obtenerRegistros(filtros = {}) {
  let resultado = [...registros]

  // Filtrar por coordinador
  if (filtros.coordinadorId) {
    resultado = resultado.filter(
      (r) => r.coordinador.id === filtros.coordinadorId,
    )
  }

  // Filtrar por fecha desde
  if (filtros.desde) {
    const desde = new Date(filtros.desde)
    resultado = resultado.filter((r) => new Date(r.fecha) >= desde)
  }

  // Filtrar por fecha hasta
  if (filtros.hasta) {
    const hasta = new Date(filtros.hasta)
    hasta.setHours(23, 59, 59, 999)
    resultado = resultado.filter((r) => new Date(r.fecha) <= hasta)
  }

  return resultado
}

// ── Obtener cantidad total ────────────────────────────────────
function totalRegistros() {
  return registros.length
}

module.exports = {
  registrarConsulta,
  obtenerRegistros,
  totalRegistros,
}
