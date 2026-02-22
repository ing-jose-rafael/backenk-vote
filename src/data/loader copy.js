const path = require('path')
const fs = require('fs')
const { Pool } = require('pg')

// Configuración de la conexión a PostgreSQL (Seenode)
// ═══════════════════════════════════════════════════════════════
// Usa variables de entorno para mayor seguridad
const pool = new Pool({
  host: process.env.DB_HOST || 'up-de-fra1-postgresql-1.db.run-on-seenode.com',
  port: process.env.DB_PORT || 11550,
  database: process.env.DB_NAME || 'db_tbb569v84f9i',
  user: process.env.DB_USER || 'db_tbb569v84f9i',
  password: process.env.DB_PASSWORD || '1wt3wx6rgJxAT15QiduYkr7s',
  // ⚠️ IMPORTANTE: HABILITAR SSL PARA SEENODE ⚠️
  ssl: {
    rejectUnauthorized: false, // Solo para desarrollo, en producción usar true con certificados
  },
  // Opcional: límite de conexiones
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Cargar el JSON una sola vez al iniciar
// ═══════════════════════════════════════════════════════════════
//  CARGAR VOTANTES (JSON principal)
// ═══════════════════════════════════════════════════════════════

const dataPath = path.join(__dirname, '..', 'votantes.json')
const votantes = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

// Crear un Map indexado por cédula para búsqueda rápida O(1)
const indexPorCedula = new Map()
votantes.forEach((v) => {
  if (v.cedula) {
    indexPorCedula.set(v.cedula.trim(), v)
  }
})

console.log(`✅  Votantes cargados: ${votantes.length} registros`)
// ═══════════════════════════════════════════════════════════════
//  CARGAR PUESTOS DE VOTACIÓN (JSON adicional)
// ═══════════════════════════════════════════════════════════════

// let puestosVotacion = new Map()
// let puestosArray = []
// let puestosCargados = false

// try {
//   const puestosPath = path.join(__dirname, '..', 'data', 'censo.json')

//   if (fs.existsSync(puestosPath)) {
//     const puestosContent = fs.readFileSync(puestosPath, 'utf-8')
//     const puestosData = JSON.parse(puestosContent)

//     // El JSON puede ser un array directamente o un objeto con una propiedad array
//     puestosArray = Array.isArray(puestosData)
//       ? puestosData
//       : puestosData.puestos || puestosData.votantes || []

//     // Indexar por cédula para búsqueda rápida O(1)
//     puestosArray.forEach((record) => {
//       if (record.cedula) {
//         const cedula = record.cedula.toString().trim()
//         puestosVotacion.set(cedula, {
//           departamento: record.departamento || '',
//           municipio: record.municipio || '',
//           zona: record.zona || '',
//           puestoVotacion: record.puesto_votacion || record.puestoVotacion || '',
//           direccionPuesto:
//             record.direccion_puesto_votacion || record.direccionPuesto || '',
//           mesa: record.mesa || '',
//         })
//       }
//     })

//     puestosCargados = true
//     console.log(
//       `✅  Puestos de votación cargados: ${puestosVotacion.size} registros`,
//     )
//   } else {
//     console.warn(`⚠️  Archivo de puestos no encontrado: ${puestosPath}`)
//     console.warn(
//       `⚠️  El sistema funcionará sin información de puestos de votación`,
//     )
//   }
// } catch (error) {
//   console.error(`❌  Error al cargar puestos de votación: ${error.message}`)
//   console.warn(
//     `⚠️  El sistema funcionará sin información de puestos de votación`,
//   )
// }

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  CARGAR PUESTOS DE VOTACIÓN (DESDE POSTGRESQL)
// ═══════════════════════════════════════════════════════════════

let puestosVotacion = new Map()
let puestosArray = []
let puestosCargados = false

// Función asíncrona para cargar datos desde PostgreSQL
async function cargarPuestosDesdeDB() {
  try {
    // Consulta SQL para obtener todos los registros de la tabla censo
    // Ajusta el nombre de la tabla según tu estructura en Seenode
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

    const result = await pool.query(query)

    if (result.rows.length > 0) {
      puestosArray = result.rows

      // Indexar por cédula para búsqueda rápida O(1)
      puestosArray.forEach((record) => {
        if (record.cedula) {
          const cedula = record.cedula.toString().trim()
          puestosVotacion.set(cedula, {
            departamento: record.departamento || '',
            municipio: record.municipio || '',
            zona: record.zona || '',
            puestoVotacion:
              record.puesto_votacion || record.puestoVotacion || '',
            direccionPuesto:
              record.direccion_puesto_votacion || record.direccionPuesto || '',
            mesa: record.mesa || '',
          })
        }
      })

      puestosCargados = true
      console.log(
        `✅  Puestos de votación cargados desde PostgreSQL: ${puestosVotacion.size} registros`,
      )
    } else {
      console.warn(`⚠️  No se encontraron registros en la tabla censo`)
      console.warn(
        `⚠️  El sistema funcionará sin información de puestos de votación`,
      )
    }
  } catch (error) {
    console.error(
      `❌  Error al cargar puestos de votación desde PostgreSQL: ${error.message}`,
    )
    console.warn(
      `⚠️  El sistema funcionará sin información de puestos de votación`,
    )
  }
}

// Ejecutar la carga asíncrona
// NOTA: Como esto es asíncrono, necesitas asegurarte que los datos estén cargados
// antes de usarlos en tu aplicación
//cargarPuestosDesdeDB()

module.exports = {
  // Votantes
  votantes,
  indexPorCedula,
  total: votantes.length,

  // Puestos de votación
  puestosVotacion,
  puestosArray,
  puestosCargados,

  cargarPuestosDesdeDB, // Exporta la función por si quieres recargar manualmente en algún momento
}
