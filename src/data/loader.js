const path = require("path");
const fs = require("fs");

// Cargar el JSON una sola vez al iniciar
const dataPath = path.join(__dirname, "..", "votantes.json");
const votantes = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

// Crear un Map indexado por cédula para búsqueda rápida O(1)
const indexPorCedula = new Map();
votantes.forEach((v) => {
  if (v.cedula) {
    indexPorCedula.set(v.cedula.trim(), v);
  }
});

module.exports = {
  votantes,
  indexPorCedula,
  total: votantes.length,
};
