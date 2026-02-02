# API Votantes — con Autenticación y Auditoria

Backend en Node.js + Express. Solo coordinadores autenticados pueden consultar datos. Cada consulta se guarda en un registro de auditoría.

---

## 📁 Estructura

```
proyecto/
├── package.json
├── README.md
└── src/
    ├── app.js                      ← Entrada principal
    ├── votantes.json               ← Base de datos (3,449 registros)
    ├── data/
    │   ├── loader.js               ← Carga y indexa votantes
    │   ├── usuarios.json           ← Usuarios/coordinadores (generado)
    │   └── auditoria.json          ← Log de consultas (se crea al usar)
    ├── middleware/
    │   ├── auth.js                 ← Login, tokens, middleware autenticar
    │   └── auditoria.js            ← Registra y consulta el log
    └── routes/
        └── votantes.js             ← Todos los endpoints
```

---

## ⚙️ Instalación y ejecución

```bash
npm install
npm start          # producción
npm run dev        # desarrollo con recarga
```

Servidor en **http://localhost:3000**

---

## 🔐 Flujo de uso

1. **Login** → obtener token
2. **Consultar** → enviar token en cada petición
3. **Logout** → invalida el token (opcional)

---

## 📡 Endpoints

### 1. Login (público)

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "orlando.polo",
  "password": "orlandopolo2024"
}
```

**Respuesta (200):**
```json
{
  "success": true,
  "mensaje": "Bienvenido, ORLANDO POLO",
  "data": {
    "token": "a1b2c3d4e5f6...",
    "usuario": {
      "id": "orlando.polo",
      "nombreCoordinador": "ORLANDO POLO",
      "rol": "coordinador"
    }
  }
}
```

---

### 2. Consultar por cédula (protegido)

```
GET /api/votantes/cedula/1046346406
Authorization: Bearer <token>
```

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "nombreCompleto": "JOHN ENRIQUE TAPIA POLO",
    "cedula": "1046346406",
    "direccion": "CALLE 5 # 6A - 51",
    "barrio": "CHIMBA",
    "celular": 3015340844,
    "lider": "JOHN TAPIA POLO",
    "coordinador": "EE",
    "grupo": "EE",
    "genero": "M"
  }
}
```

---

### 3. Consultar por nombre (protegido)

```
GET /api/votantes/nombre/TAPIA
Authorization: Bearer <token>
```

---

### 4. Estadísticas (protegido)

```
GET /api/votantes/stats
Authorization: Bearer <token>
```

---

### 5. Auditoría (solo admin)

```
GET /api/auditoria
Authorization: Bearer <token_admin>
```

Filtros opcionales por query params:
- `coordinadorId` — ej: `orlando.polo`
- `desde` — ej: `2026-02-01`
- `hasta` — ej: `2026-02-28`

```
GET /api/auditoria?coordinadorId=orlando.polo&desde=2026-02-01
```

**Respuesta (200):**
```json
{
  "success": true,
  "total": 2,
  "data": [
    {
      "id": 1,
      "fecha": "2026-02-01T22:30:00.000Z",
      "coordinador": { "id": "orlando.polo", "nombreCoordinador": "ORLANDO POLO", "rol": "coordinador" },
      "tipoConsulta": "cedula",
      "parametro": "1046346406",
      "resultadoEncontrado": true
    }
  ]
}
```

---

### 6. Estadísticas Avanzadas (solo admin)

```
GET /api/votantes/stats/avanzadas
Authorization: Bearer <token_admin>
```

Retorna análisis detallado incluyendo:
- **Resumen general**: total votantes, cédulas únicas, duplicados, porcentaje
- **Duplicados**: cédulas que aparecen 2+ veces con detalles de cada registro
- **Top coordinadores**: Los 10 con más votantes asignados
- **Top barrios**: Los 10 con más concentración de votantes
- **Top líderes**: Los 10 con más votantes bajo su responsabilidad

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "resumen": {
      "totalVotantes": 3449,
      "cedulasUnicas": 3238,
      "totalDuplicados": 158,
      "votantesDuplicados": 369,
      "porcentajeDuplicados": "4.88"
    },
    "duplicados": [
      {
        "cedula": "1002096640",
        "repeticiones": 20,
        "votantes": [
          {
            "nombreCompleto": "OLGA POLO MERCADO",
            "coordinador": "EE",
            "barrio": "CENTRO",
            "direccion": "CALLE 1 # 2 - 3"
          }
        ]
      }
    ],
    "topCoordinadores": [
      { "coordinador": "EE", "cantidad": 1103 },
      { "coordinador": "POLO ECKER", "cantidad": 559 }
    ],
    "topBarrios": [
      { "barrio": "CENTRO", "cantidad": 385 },
      { "barrio": "ALGODONAL", "cantidad": 261 }
    ],
    "topLideres": [
      { "lider": "JOHN TAPIA POLO", "cantidad": 150 }
    ]
  }
}
```

---

### 7. Logout (protegido)

```
POST /api/auth/logout
Authorization: Bearer <token>
```

---

## 👥 Usuarios disponibles

| Username | Nombre | Contraseña |
|---|---|---|
| `admin` | ADMINISTRADOR | `admin2024` |
| `orlando.polo` | ORLANDO POLO | `orlandopolo2024` |
| `robinson.villa` | ROBINSON VILLA | `robinsonvilla2024` |
| `einer.escorcia` | EINER ESCORCIA | `einerescorcia2024` |
| `urbano.ortiz` | URBANO ORTIZ | `urbanoortiz2024` |
| ... | *(ver usuarios.json para todos)* | |

> La contraseña por defecto de cada coordinador es su nombre sin espacios en minúsculas + `2024`.

---

## 💡 Notas técnicas

- Tokens se almacenan en memoria y expiran tras **4 horas**.
- El log de auditoría se persiste en `src/data/auditoria.json` cada vez que se registra una consulta.
- La búsqueda por cédula es O(1) usando un Map indexado.
- CORS habilitado para cualquier origen.
# backenk-vote
