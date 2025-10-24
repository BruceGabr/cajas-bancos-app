import express from "express";
import cors from "cors";
import multer from "multer";
import { procesarConciliacion } from "./controllers/excelController.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Crear carpeta uploads si no existe
const uploadsDir = join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware: CORS para permitir frontend en Vercel
app.use(
  cors({
    origin: "https://cajas-bancos-app-9aiv.vercel.app", // URL de tu frontend en Vercel
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ".xlsx");
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos Excel (.xlsx, .xls)"));
    }
  },
});

// Rutas
app.get("/", (req, res) => {
  res.json({
    message: "API de Conciliación Bancaria funcionando correctamente",
  });
});

app.post(
  "/api/procesar",
  upload.fields([
    { name: "estadoCuenta", maxCount: 1 },
    { name: "cajasYBancos", maxCount: 1 },
  ]),
  procesarConciliacion
);

// Limpieza de archivos temporales cada hora
setInterval(() => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return;

    const now = Date.now();
    files.forEach((file) => {
      const filePath = join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        // Eliminar archivos más antiguos de 1 hora
        if (now - stats.mtimeMs > 3600000) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 3600000);

// Manejo de errores
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: error.message || "Error interno del servidor",
  });
});

// Escuchar puerto asignado por Render
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en Render en el puerto ${PORT}`);
});
