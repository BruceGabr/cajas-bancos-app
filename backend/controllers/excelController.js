import XlsxPopulate from "xlsx-populate";
import fs from "fs";

// Convertir fecha de Excel a Date real
const convertirFechaExcel = (fecha) => {
  if (!fecha) return null;

  let fechaDate;

  if (fecha instanceof Date) {
    fechaDate = new Date(fecha);
  } else if (typeof fecha === "number") {
    fechaDate = new Date(Math.round((fecha - 25569) * 86400 * 1000));
  } else if (typeof fecha === "string") {
    const partes = fecha.split(/[-/]/);
    if (partes.length === 3) {
      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Mes base 0
      let año = parseInt(partes[2], 10);
      if (año < 100) año += 2000;
      fechaDate = new Date(año, mes, dia);
    } else {
      fechaDate = new Date(fecha);
    }
  } else {
    fechaDate = new Date(fecha);
  }

  // Ajuste para zona horaria
  fechaDate.setMinutes(fechaDate.getMinutes() - fechaDate.getTimezoneOffset());
  return fechaDate;
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
    for (let col of ["B", "C", "D", "E"]) {
      const val = sheet.cell(`${col}${i}`).value();
      if (val && val.toString().includes("F. Operaci")) {
        headerRow = i;
        break;
      }
    }
    if (headerRow) break;
  }

  if (!headerRow)
    throw new Error("No se encontró el encabezado en el estado de cuenta");

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

    if (
      conceptoStr.startsWith("Saldo Inicial:") ||
      conceptoStr.startsWith("Saldo Final:") ||
      conceptoStr === "ITF" ||
      conceptoStr.startsWith("COMIS")
    )
      continue;

    let nDoc = sheet.cell(row, nDocCol).value();
    if (nDoc) nDoc = nDoc.toString().trim();

    const fecha = sheet.cell(row, fOpCol).value();
    const importe = parseFloat(sheet.cell(row, importeCol).value()) || 0;

    registros.push({ fecha, nDoc, descripcion: conceptoStr, importe });
  }

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

    const estadoCuentaPath = req.files.estadoCuenta[0].path;
    const cajasYBancosPath = req.files.cajasYBancos[0].path;

    const registrosEC = await procesarEstadoCuenta(estadoCuentaPath);
    const workbook = await XlsxPopulate.fromFileAsync(cajasYBancosPath);

    const sheetName = `${mes} ${moneda}`;
    let sheet;
    try {
      sheet = workbook.sheet(sheetName);
    } catch (error) {
      return res.status(400).json({
        error: `Hoja "${sheetName}" no encontrada. Hojas disponibles: ${workbook
          .sheets()
          .map((s) => s.name())
          .join(", ")}`,
      });
    }

    const startRow = moneda === "ME" ? 32 : 33;
    const colFecha = 3; // C
    const colN = 6; // F
    const colDesc = 8; // H
    const colDebe = 14; // N
    const colHaber = 15; // O

    // Última fila con datos
    let lastRow = startRow;
    while (sheet.cell(lastRow, colN).value()) lastRow++;

    let lastNDoc = 0;
    if (lastRow > startRow) {
      const lastNValue = sheet.cell(lastRow - 1, colN).value();
      if (lastNValue)
        lastNDoc = parseInt(lastNValue.toString().replace(/^0+/, "")) || 0;
    }

    const registrosNuevos = registrosEC.filter(
      (r) => parseInt(r.nDoc) > lastNDoc
    );

    if (registrosNuevos.length === 0) {
      fs.unlinkSync(estadoCuentaPath);
      fs.unlinkSync(cajasYBancosPath);
      return res.json({
        success: true,
        registrosAgregados: 0,
        message: "No hay registros nuevos para agregar",
      });
    }

    // 🔧 Insertar registros
    registrosNuevos.forEach((reg, idx) => {
      const rowIdx = lastRow + idx;

      // Fecha
      const cellFecha = sheet.cell(rowIdx, colFecha);
      const fechaExcel = convertirFechaExcel(reg.fecha);
      cellFecha.value(fechaExcel);

      // 🔹 N° Documento — insertar como número, manteniendo formato original
      const nDocCell = sheet.cell(rowIdx, colN);
      const formatoOriginal = nDocCell.style("numberFormat"); // guardar formato previo

      let nDocNumerico = null;
      if (reg.nDoc && /^\d+$/.test(reg.nDoc.trim())) {
        nDocNumerico = parseInt(reg.nDoc.trim(), 10);
        nDocCell.value(nDocNumerico);
      } else {
        nDocCell.value(reg.nDoc?.trim() || "");
      }

      // Restaurar formato original (mantener “Código postal” u otro)
      if (formatoOriginal) {
        nDocCell.style("numberFormat", formatoOriginal);
      }

      // Descripción
      sheet.cell(rowIdx, colDesc).value(reg.descripcion);

      // Importes
      if (reg.importe > 0) {
        sheet
          .cell(rowIdx, colDebe)
          .value(reg.importe)
          .style("numberFormat", "#,##0.00");
        sheet.cell(rowIdx, colHaber).value(0).style("numberFormat", "#,##0.00");
      } else {
        sheet.cell(rowIdx, colDebe).value(null);
        sheet
          .cell(rowIdx, colHaber)
          .value(Math.abs(reg.importe))
          .style("numberFormat", "#,##0.00");
      }

      // 🟨 Resaltar en amarillo las columnas C → O
      for (let col = 3; col <= 15; col++) {
        sheet.cell(rowIdx, col).style("fill", "FFFF00");
      }
    });

    // Guardar archivo final
    const outputPath = cajasYBancosPath.replace(".xlsx", "-actualizado.xlsx");
    await workbook.toFileAsync(outputPath);

    const fileBuffer = fs.readFileSync(outputPath);
    const base64File = fileBuffer.toString("base64");

    // Limpiar archivos temporales
    fs.unlinkSync(estadoCuentaPath);
    fs.unlinkSync(cajasYBancosPath);
    fs.unlinkSync(outputPath);

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
    if (req.files) {
      try {
        if (req.files.estadoCuenta)
          fs.unlinkSync(req.files.estadoCuenta[0].path);
        if (req.files.cajasYBancos)
          fs.unlinkSync(req.files.cajasYBancos[0].path);
      } catch {}
    }
    res.status(500).json({
      error: error.message || "Error procesando archivos",
      details: error.stack,
    });
  }
};
