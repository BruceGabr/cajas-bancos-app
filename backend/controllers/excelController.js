import XlsxPopulate from "xlsx-populate";
import fs from "fs";

// Convertir fecha de Excel a formato DD/MM/YYYY
const convertirFechaExcel = (fecha) => {
  if (!fecha) return "";

  if (
    typeof fecha === "string" &&
    (fecha.includes("-") || fecha.includes("/"))
  ) {
    const partes = fecha.split(/[-/]/);
    if (partes.length === 3) {
      const dia = partes[0].padStart(2, "0");
      const mes = partes[1].padStart(2, "0");
      const año =
        partes[2].length === 4 ? partes[2] : "20" + partes[2].padStart(2, "0");
      return `${dia}/${mes}/${año}`; // <-- Cambio a "/" y año completo
    }
    return fecha;
  }

  if (typeof fecha === "number") {
    const date = new Date((fecha - 25569) * 86400 * 1000);
    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const año = String(date.getFullYear()); // <-- Año completo
    return `${dia}/${mes}/${año}`;
  }

  if (fecha instanceof Date) {
    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const año = String(fecha.getFullYear()); // <-- Año completo
    return `${dia}/${mes}/${año}`;
  }

  return String(fecha);
};

// Procesar Estado de Cuenta
const procesarEstadoCuenta = async (filePath) => {
  const workbook = await XlsxPopulate.fromFileAsync(filePath);
  const sheet = workbook.sheet(0);

  // Buscar encabezado
  let headerRow = null;
  for (let i = 1; i <= 50; i++) {
    const cellValue = sheet.cell(`A${i}`).value();
    if (cellValue && cellValue.toString().includes("F. Operaci")) {
      headerRow = i;
      break;
    }

    // Buscar en otras columnas también
    for (let col of ["B", "C", "D", "E"]) {
      const val = sheet.cell(`${col}${i}`).value();
      if (val && val.toString().includes("F. Operaci")) {
        headerRow = i;
        break;
      }
    }
    if (headerRow) break;
  }

  if (!headerRow) {
    throw new Error("No se encontró el encabezado en el estado de cuenta");
  }

  // Identificar columnas
  const usedRange = sheet.usedRange();
  const endCol = usedRange.endCell().columnNumber();

  let fOpCol = null,
    nDocCol = null,
    conceptoCol = null,
    importeCol = null;

  for (let col = 1; col <= endCol; col++) {
    const headerValue = sheet.cell(headerRow, col).value();
    if (!headerValue) continue;

    const headerStr = headerValue.toString();
    if (headerStr.includes("F. Operaci")) fOpCol = col;
    if (headerStr.includes("Doc")) nDocCol = col;
    if (headerStr.includes("Concepto")) conceptoCol = col;
    if (headerStr.includes("Importe")) importeCol = col;
  }

  if (!fOpCol || !nDocCol || !conceptoCol || !importeCol) {
    throw new Error("No se encontraron todas las columnas necesarias");
  }

  // Extraer registros
  const registros = [];
  const endRow = usedRange.endCell().rowNumber();

  for (let row = headerRow + 1; row <= endRow; row++) {
    const concepto = sheet.cell(row, conceptoCol).value();
    if (!concepto) continue;

    const conceptoStr = concepto.toString().trim();

    // Filtrar registros no deseados
    if (
      conceptoStr.startsWith("Saldo Inicial:") ||
      conceptoStr.startsWith("Saldo Final:") ||
      conceptoStr === "ITF" ||
      conceptoStr.startsWith("COMIS")
    ) {
      continue;
    }

    let nDoc = sheet.cell(row, nDocCol).value();
    if (nDoc) {
      nDoc = nDoc.toString().trim().replace(/^0+/, "") || "0";
    }

    const fecha = sheet.cell(row, fOpCol).value();
    const importe = parseFloat(sheet.cell(row, importeCol).value()) || 0;

    registros.push({
      fecha: fecha,
      nDoc: nDoc,
      descripcion: conceptoStr,
      importe: importe,
    });
  }

  // Ordenar por Nº Doc
  registros.sort((a, b) => parseInt(a.nDoc) - parseInt(b.nDoc));

  return registros;
};

// Controlador principal
export const procesarConciliacion = async (req, res) => {
  console.log("📥 Solicitud recibida");
  console.log("Moneda:", req.body.moneda);
  console.log("Mes:", req.body.mes);
  console.log("Archivos recibidos:", req.files);

  try {
    const { moneda, mes } = req.body;

    if (!req.files || !req.files.estadoCuenta || !req.files.cajasYBancos) {
      console.error("❌ Faltan archivos");
      return res.status(400).json({ error: "Faltan archivos requeridos" });
    }

    console.log("✅ Archivos validados");

    const estadoCuentaPath = req.files.estadoCuenta[0].path;
    const cajasYBancosPath = req.files.cajasYBancos[0].path;

    console.log("📄 Estado de Cuenta:", estadoCuentaPath);
    console.log("📄 Cajas y Bancos:", cajasYBancosPath);

    // Procesar estado de cuenta
    console.log("🔄 Procesando estado de cuenta...");
    const registrosEC = await procesarEstadoCuenta(estadoCuentaPath);
    console.log(
      `✅ ${registrosEC.length} registros extraídos del estado de cuenta`
    );

    // Abrir Cajas y Bancos (preserva TODOS los estilos)
    console.log("📂 Abriendo Cajas y Bancos...");
    const workbook = await XlsxPopulate.fromFileAsync(cajasYBancosPath);
    const sheetName = `${mes} ${moneda}`;
    console.log("📋 Buscando hoja:", sheetName);

    let sheet;
    try {
      sheet = workbook.sheet(sheetName);
      console.log("✅ Hoja encontrada:", sheetName);
    } catch (error) {
      console.error("❌ Hoja no encontrada:", sheetName);
      console.log(
        "📋 Hojas disponibles:",
        workbook.sheets().map((s) => s.name())
      );
      return res.status(400).json({
        error: `Hoja "${sheetName}" no encontrada. Hojas disponibles: ${workbook
          .sheets()
          .map((s) => s.name())
          .join(", ")}`,
      });
    }

    // Configuración según moneda
    const startRow = moneda === "ME" ? 32 : 33; // xlsx-populate usa índices base-1
    const colFecha = 3; // Columna C
    const colN = 6; // Columna F
    const colDesc = 8; // Columna H
    const colDebe = 14; // Columna N
    const colHaber = 15; // Columna O

    console.log("⚙️ Configuración:");
    console.log("  - Fila inicial:", startRow);
    console.log("  - Columnas: Fecha(C), N°(F), Desc(H), Debe(N), Haber(O)");

    // Encontrar última fila con datos
    console.log("🔍 Buscando última fila con datos...");
    let lastRow = startRow;
    while (true) {
      const cellValue = sheet.cell(lastRow, colN).value();
      if (!cellValue) break;
      lastRow++;
    }
    console.log("📍 Última fila con datos:", lastRow - 1);

    // Obtener último Nº Doc
    let lastNDoc = 0;
    if (lastRow > startRow) {
      const lastNValue = sheet.cell(lastRow - 1, colN).value();
      if (lastNValue) {
        lastNDoc = parseInt(lastNValue.toString().replace(/^0+/, "")) || 0;
      }
    }
    console.log("🔢 Último N° Doc:", lastNDoc);

    // Filtrar registros nuevos
    const registrosNuevos = registrosEC.filter(
      (r) => parseInt(r.nDoc) > lastNDoc
    );
    console.log(`📊 Registros nuevos a agregar: ${registrosNuevos.length}`);

    if (registrosNuevos.length === 0) {
      console.log("⚠️ No hay registros nuevos");
      // Limpiar archivos temporales
      fs.unlinkSync(estadoCuentaPath);
      fs.unlinkSync(cajasYBancosPath);

      return res.json({
        success: true,
        registrosAgregados: 0,
        message: "No hay registros nuevos para agregar",
      });
    }

    // Insertar registros nuevos
    console.log("✏️ Insertando registros...");

    registrosNuevos.forEach((reg, idx) => {
      const rowIdx = lastRow + idx;
      const fechaDate = convertirFechaExcel(reg.fecha);

      console.log(
        `  ${idx + 1}. Fila ${rowIdx}: ${fechaDate} - ${
          reg.nDoc
        } - ${reg.descripcion.substring(0, 30)}...`
      );

      // FECHA - Insertar como Date object para que Excel maneje el formato
      const cellFecha = sheet.cell(rowIdx, colFecha);
      cellFecha.value(fechaDate);
      // No forzar formato, dejar que Excel use su formato personalizado de la columna

      // Nº - Insertar como string prefijado con apóstrofe para forzar texto
      const cellN = sheet.cell(rowIdx, colN);
      // Usar fórmula que devuelve texto para evitar triángulo verde
      cellN.value(`${reg.nDoc}`);

      // DESCRIPCIÓN
      sheet.cell(rowIdx, colDesc).value(reg.descripcion);

      // DEBE y HABER - siempre como números con formato numérico
      if (reg.importe > 0) {
        // Ingreso: DEBE tiene monto, HABER tiene 0
        const cellDebe = sheet.cell(rowIdx, colDebe);
        cellDebe.value(reg.importe);
        cellDebe.style("numberFormat", "#,##0.00");

        const cellHaber = sheet.cell(rowIdx, colHaber);
        cellHaber.value(0);
        cellHaber.style("numberFormat", "#,##0.00");
      } else {
        // Egreso: DEBE vacío, HABER tiene monto
        // Dejar DEBE sin valor (vacío)
        const cellHaber = sheet.cell(rowIdx, colHaber);
        cellHaber.value(Math.abs(reg.importe));
        cellHaber.style("numberFormat", "#,##0.00");
      }
    });

    console.log("💾 Guardando archivo...");
    // Guardar archivo modificado
    const outputPath = cajasYBancosPath.replace(".xlsx", "-actualizado.xlsx");
    await workbook.toFileAsync(outputPath);
    console.log("✅ Archivo guardado:", outputPath);

    // Leer archivo para enviarlo
    console.log("📤 Convirtiendo a base64...");
    const fileBuffer = fs.readFileSync(outputPath);
    const base64File = fileBuffer.toString("base64");
    console.log("✅ Conversión completada");

    // Limpiar archivos temporales
    console.log("🧹 Limpiando archivos temporales...");
    fs.unlinkSync(estadoCuentaPath);
    fs.unlinkSync(cajasYBancosPath);
    fs.unlinkSync(outputPath);
    console.log("✅ Limpieza completada");

    console.log("🎉 Proceso completado exitosamente");
    res.json({
      success: true,
      registrosAgregados: registrosNuevos.length,
      message: `${registrosNuevos.length} registro(s) agregado(s) exitosamente`,
      file: base64File,
      fileName: `Cajas_Bancos_${mes}_${moneda}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`,
    });
  } catch (error) {
    console.error("💥 ERROR CRÍTICO:", error);
    console.error("Stack trace:", error.stack);

    // Limpiar archivos en caso de error
    if (req.files) {
      try {
        if (req.files.estadoCuenta) {
          fs.unlinkSync(req.files.estadoCuenta[0].path);
          console.log("🧹 Estado de cuenta eliminado");
        }
        if (req.files.cajasYBancos) {
          fs.unlinkSync(req.files.cajasYBancos[0].path);
          console.log("🧹 Cajas y bancos eliminado");
        }
      } catch (cleanupError) {
        console.error("Error limpiando archivos:", cleanupError);
      }
    }

    res.status(500).json({
      error: error.message || "Error procesando archivos",
      details: error.stack,
    });
  }
};
