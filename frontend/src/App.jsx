import React, { useState } from "react";
import {
  Upload,
  Download,
  AlertCircle,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  XCircle,
} from "lucide-react";

const API_URL = "https://cajas-bancos-app-production.up.railway.app";

const BancoReconciliacion = () => {
  const [estadoCuentaFile, setEstadoCuentaFile] = useState(null);
  const [cajasFile, setCajasFile] = useState(null);
  const [moneda, setMoneda] = useState("MN");
  const [mes, setMes] = useState("ENERO");
  const [alerts, setAlerts] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [resultFile, setResultFile] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [showNoAgregados, setShowNoAgregados] = useState(false);

  const meses = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SETIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ];

  const procesarArchivos = async () => {
    if (!estadoCuentaFile || !cajasFile) {
      setAlerts([{ type: "error", msg: "Debes subir ambos archivos" }]);
      return;
    }

    setProcessing(true);
    setAlerts([]);
    setResultFile(null);
    setResultData(null);
    setShowNoAgregados(false);

    try {
      const formData = new FormData();
      formData.append("estadoCuenta", estadoCuentaFile);
      formData.append("cajasYBancos", cajasFile);
      formData.append("moneda", moneda);
      formData.append("mes", mes);

      const response = await fetch(`${API_URL}/api/procesar`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error procesando archivos");
      }

      if (data.success) {
        setAlerts([
          {
            type: "success",
            msg: data.message,
          },
        ]);

        setResultData({
          totalRegistrosEstadoCuenta: data.totalRegistrosEstadoCuenta,
          registrosAgregados: data.registrosAgregados,
          registrosNoAgregados: data.registrosNoAgregados,
          detallesNoAgregados: data.detallesNoAgregados || [],
        });

        if (data.file) {
          setResultFile({
            data: data.file,
            name: data.fileName,
          });
        }
      }
    } catch (error) {
      setAlerts([
        {
          type: "error",
          msg: error.message || "Error de conexión con el servidor",
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const descargarArchivo = () => {
    if (!resultFile) return;

    const byteCharacters = atob(resultFile.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resultFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRazonColor = (razon) => {
    switch (razon) {
      case "Ya registrado":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "ITF":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "Comisión":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Sistema de Conciliación Bancaria
          </h1>
          <p className="text-slate-600">
            BBVA - Automatización de Cajas y Bancos
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                processing ? "bg-yellow-500 animate-pulse" : "bg-green-500"
              }`}
            ></div>
            <span className="text-slate-600">
              {processing ? "Procesando..." : "Sistema listo"}
            </span>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-4 rounded-lg ${
                  alert.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : alert.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{alert.msg}</span>
              </div>
            ))}
          </div>
        )}

        {resultData && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              📊 Resumen del Procesamiento
            </h2>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600 font-medium mb-1">
                  Total Estado de Cuenta
                </p>
                <p className="text-3xl font-bold text-blue-700">
                  {resultData.totalRegistrosEstadoCuenta}
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-600 font-medium mb-1">
                  Registros Agregados
                </p>
                <p className="text-3xl font-bold text-green-700">
                  {resultData.registrosAgregados}
                </p>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-orange-600 font-medium mb-1">
                  No Agregados
                </p>
                <p className="text-3xl font-bold text-orange-700">
                  {resultData.registrosNoAgregados}
                </p>
              </div>
            </div>

            {resultData.registrosNoAgregados > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowNoAgregados(!showNoAgregados)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-slate-700">
                      Ver registros no agregados (
                      {resultData.registrosNoAgregados})
                    </span>
                  </div>
                  {showNoAgregados ? (
                    <ChevronUp className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  )}
                </button>

                {showNoAgregados && (
                  <div className="p-4 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">
                              Fecha
                            </th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">
                              N° Doc
                            </th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">
                              Descripción
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-slate-700">
                              Importe
                            </th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">
                              Razón
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultData.detallesNoAgregados.map((reg, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-slate-100 hover:bg-slate-50"
                            >
                              <td className="py-2 px-3 text-slate-700">
                                {reg.fecha}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {reg.nDoc}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {reg.descripcion}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {reg.importe.toFixed(2)}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getRazonColor(
                                    reg.razon
                                  )}`}
                                >
                                  {reg.razon}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            1. Subir Archivos
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Estado de Cuenta BBVA
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setEstadoCuentaFile(e.target.files[0])}
                  className="hidden"
                  id="estado-cuenta"
                />
                <label
                  htmlFor="estado-cuenta"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer transition-all hover:shadow-lg"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {estadoCuentaFile
                      ? "Cambiar archivo"
                      : "Seleccionar archivo"}
                  </span>
                </label>
                {estadoCuentaFile && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {estadoCuentaFile.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Libro de Cajas y Bancos
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setCajasFile(e.target.files[0])}
                  className="hidden"
                  id="cajas-bancos"
                />
                <label
                  htmlFor="cajas-bancos"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg cursor-pointer transition-all hover:shadow-lg"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {cajasFile ? "Cambiar archivo" : "Seleccionar archivo"}
                  </span>
                </label>
                {cajasFile && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {cajasFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-slate-800 mb-4 mt-8">
            2. Configurar Parámetros
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Moneda
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setMoneda("MN")}
                  disabled={processing}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    moneda === "MN"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Soles (MN)
                </button>
                <button
                  onClick={() => setMoneda("ME")}
                  disabled={processing}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    moneda === "ME"
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Dólares (ME)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Mes
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                disabled={processing}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-slate-800 mb-4 mt-8">
            3. Procesar y Descargar
          </h2>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={procesarArchivos}
              disabled={!estadoCuentaFile || !cajasFile || processing}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl disabled:shadow-none disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Procesar Conciliación
                </>
              )}
            </button>

            {resultFile && (
              <button
                onClick={descargarArchivo}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
              >
                <Download className="w-5 h-5" />
                Descargar Archivo Actualizado
              </button>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            ℹ️ Funcionamiento
          </h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>
                El sistema preserva automáticamente todos los estilos y formatos
                del Excel original
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>
                Las fechas se formatean como DD-MM-YYYY (ejemplo: 20-10-2025)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Los ingresos se registran en DEBE y 0 en HABER</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Los egresos se registran en HABER</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>
                Se excluyen automáticamente: saldos iniciales/finales, ITF y
                comisiones
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>
                Los registros duplicados no se agregan y se muestran en el
                resumen
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BancoReconciliacion;
