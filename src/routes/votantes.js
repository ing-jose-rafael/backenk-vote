const express = require("express");
const router = express.Router();
const { votantes, indexPorCedula, total } = require("../data/loader");
const { validarCredenciales, generarToken, autenticar, soloAdmin, invalidarToken } = require("../middleware/auth");
const { registrarConsulta, obtenerRegistros } = require("../middleware/auditoria");

// ═══════════════════════════════════════════════════════════════
//  RUTAS PÚBLICAS  (sin token)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { "username": "orlando.polo", "password": "orlandopolo2024" }
// ─────────────────────────────────────────────
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error: "Se requieren username y password en el body.",
    });
  }

  const usuario = validarCredenciales(username.trim(), password.trim());

  if (!usuario) {
    return res.status(401).json({
      error: "Credenciales incorrectas.",
    });
  }

  const token = generarToken(usuario);

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
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
router.post("/auth/logout", autenticar, (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  invalidarToken(token);

  res.json({
    success: true,
    mensaje: `Sesión cerrada para ${req.usuario.nombreCoordinador}.`,
  });
});

// ═══════════════════════════════════════════════════════════════
//  RUTAS PROTEGIDAS  (requieren token válido)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// GET /api/votantes/cedula/:numero
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
router.get("/votantes/cedula/:numero", autenticar, (req, res) => {
  const cedula = req.params.numero.trim();

  if (!cedula || !/^\d+$/.test(cedula)) {
    return res.status(400).json({
      error: "Cédula inválida. Solo se permiten números.",
    });
  }

  const votante = indexPorCedula.get(cedula);
  const encontrado = !!votante;

  // ── Registrar en auditoria ──
  registrarConsulta({
    coordinador: req.usuario,
    tipoConsulta: "cedula",
    parametro: cedula,
    resultadoEncontrado: encontrado,
  });

  if (!encontrado) {
    return res.status(404).json({
      error: "No se encontró votante con esa cédula.",
      cedula,
    });
  }

  res.json({ success: true, data: votante });
});

// ─────────────────────────────────────────────
// GET /api/votantes/nombre/:texto
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
router.get("/votantes/nombre/:texto", autenticar, (req, res) => {
  const texto = req.params.texto.trim().toUpperCase();

  if (!texto || texto.length < 2) {
    return res.status(400).json({
      error: "El texto de búsqueda debe tener al menos 2 caracteres.",
    });
  }

  const resultados = votantes.filter(
    (v) => v.nombreCompleto && v.nombreCompleto.toUpperCase().includes(texto)
  );

  const encontrado = resultados.length > 0;

  // ── Registrar en auditoria ──
  registrarConsulta({
    coordinador: req.usuario,
    tipoConsulta: "nombre",
    parametro: texto,
    resultadoEncontrado: encontrado,
  });

  if (!encontrado) {
    return res.status(404).json({
      error: "No se encontraron votantes con ese nombre.",
      busqueda: texto,
    });
  }

  res.json({
    success: true,
    total: resultados.length,
    data: resultados,
  });
});

// ─────────────────────────────────────────────
// GET /api/votantes/stats
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
router.get("/votantes/stats", autenticar, (req, res) => {
  const porGrupo = {};
  const porBarrio = {};
  const porGenero = { M: 0, F: 0, sin_dato: 0 };

  votantes.forEach((v) => {
    const grupo = v.grupo || "Sin grupo";
    porGrupo[grupo] = (porGrupo[grupo] || 0) + 1;

    const barrio = v.barrio || "Sin barrio";
    porBarrio[barrio] = (porBarrio[barrio] || 0) + 1;

    if (v.genero === "M") porGenero.M++;
    else if (v.genero === "F") porGenero.F++;
    else porGenero.sin_dato++;
  });

  res.json({
    success: true,
    data: { totalVotantes: total, porGrupo, porBarrio, porGenero },
  });
});

// ─────────────────────────────────────────────
// GET /api/votantes/stats/avanzadas (solo admin)
// Estadísticas avanzadas: duplicados, tops, etc.
// ─────────────────────────────────────────────
router.get("/votantes/stats/avanzadas", autenticar, soloAdmin, (req, res) => {
  // ── Análisis de duplicados por cédula ──
  const cedulasCount = {};
  const votantesPorCedula = {};
  
  votantes.forEach((v) => {
    if (!v.cedula) return;
    const cedula = v.cedula.trim();
    
    if (!cedulasCount[cedula]) {
      cedulasCount[cedula] = 0;
      votantesPorCedula[cedula] = [];
    }
    cedulasCount[cedula]++;
    votantesPorCedula[cedula].push(v);
  });

  // Encontrar duplicados
  const duplicados = [];
  Object.entries(cedulasCount).forEach(([cedula, count]) => {
    if (count > 1 && cedula !== 'nan') {
      duplicados.push({
        cedula,
        repeticiones: count,
        votantes: votantesPorCedula[cedula].map(v => ({
          nombreCompleto: v.nombreCompleto,
          coordinador: v.coordinador,
          barrio: v.barrio,
          direccion: v.direccion
        }))
      });
    }
  });

  // Ordenar por más repetidos
  duplicados.sort((a, b) => b.repeticiones - a.repeticiones);

  // ── Top coordinadores por cantidad de votantes ──
  const coordinadoresCount = {};
  votantes.forEach((v) => {
    const coord = v.coordinador || "Sin coordinador";
    coordinadoresCount[coord] = (coordinadoresCount[coord] || 0) + 1;
  });

  const topCoordinadores = Object.entries(coordinadoresCount)
    .map(([coordinador, cantidad]) => ({ coordinador, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  // ── Top barrios por cantidad de votantes ──
  const barriosCount = {};
  votantes.forEach((v) => {
    const barrio = v.barrio || "Sin barrio";
    barriosCount[barrio] = (barriosCount[barrio] || 0) + 1;
  });

  const topBarrios = Object.entries(barriosCount)
    .map(([barrio, cantidad]) => ({ barrio, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  // ── Top líderes por cantidad de votantes ──
  const lideresCount = {};
  votantes.forEach((v) => {
    const lider = v.lider || "Sin líder";
    lideresCount[lider] = (lideresCount[lider] || 0) + 1;
  });

  const topLideres = Object.entries(lideresCount)
    .map(([lider, cantidad]) => ({ lider, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  // ── Resumen general ──
  const cedulasUnicas = Object.keys(cedulasCount).filter(c => c !== 'nan').length;
  const totalDuplicados = duplicados.length;
  const votantesDuplicados = duplicados.reduce((sum, d) => sum + d.repeticiones, 0);

  res.json({
    success: true,
    data: {
      resumen: {
        totalVotantes: total,
        cedulasUnicas,
        totalDuplicados,
        votantesDuplicados,
        porcentajeDuplicados: ((totalDuplicados / cedulasUnicas) * 100).toFixed(2)
      },
      duplicados: duplicados.slice(0, 20), // Top 20 más duplicados
      topCoordinadores,
      topBarrios,
      topLideres
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  RUTAS ADMIN  (solo rol = admin)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// GET /api/auditoria
// Query params opcionales: coordinadorId, desde, hasta
// Ejemplo: /api/auditoria?coordinadorId=orlando.polo&desde=2026-02-01
// ─────────────────────────────────────────────
router.get("/auditoria", autenticar, soloAdmin, (req, res) => {
  const filtros = {
    coordinadorId: req.query.coordinadorId || null,
    desde: req.query.desde || null,
    hasta: req.query.hasta || null,
  };

  const registros = obtenerRegistros(filtros);

  res.json({
    success: true,
    total: registros.length,
    filtros,
    data: registros,
  });
});

module.exports = router;
