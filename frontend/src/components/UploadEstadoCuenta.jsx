import React, { useState } from "react";
import axios from "axios";

const API_URL = "https://cajas-bancos-app-production.up.railway.app"; // URL pública de tu backend

export default function UploadEstadoCuenta({ onRegistros }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Selecciona un archivo");

    const formData = new FormData();
    formData.append("estadoCuenta", file);

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/procesar`, formData);

      if (res.data.success) {
        onRegistros(res.data.registros); // asumiendo que tu backend devuelve 'registros'
        alert("Archivo procesado correctamente");
      } else {
        alert("Error procesando el archivo");
      }
    } catch (err) {
      console.error(err);
      alert("Error al subir el archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: "20px 0" }}>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
      <button
        onClick={handleUpload}
        disabled={loading}
        style={{ marginLeft: "10px" }}
      >
        {loading ? "Procesando..." : "Subir y procesar"}
      </button>
    </div>
  );
}
