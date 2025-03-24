import React, { useEffect, useState } from "react";
import { FaFilePdf } from "react-icons/fa";
import "./Cortes.css";

const Cortes = () => {
  const [ventas, setVentas] = useState([]);
  const [tipoCorte, setTipoCorte] = useState("diario");
  const [totalVentas, setTotalVentas] = useState(0);
  const [pdfPath, setPdfPath] = useState("");
  const [error, setError] = useState(""); // Estado para manejar errores
  const [nombreNegocio, setNombreNegocio] = useState(localStorage.getItem('nombreNegocio') || '');
  const [mensaje, setMensaje] = useState(""); // Estado para manejar mensajes

  useEffect(() => {
    cargarVentasDelDia();

    // Escuchar el evento de venta realizada
    const handleVentaRealizada = () => {
      cargarVentasDelDia();
    };

    // Suscribirse al evento
    window.electron.onVentaRealizada(handleVentaRealizada);

    // Limpiar el evento al desmontar el componente
    return () => {
      if (window.electron.offVentaRealizada) {
        // Usar un método "off" si está disponible
        window.electron.offVentaRealizada(handleVentaRealizada);
      } else if (window.electron.removeListener) {
        // Usar removeListener si está disponible
        window.electron.removeListener("onVentaRealizada", handleVentaRealizada);
      } else {
        console.warn("No se pudo limpiar el evento onVentaRealizada.");
      }
    };
  }, []);

  const cargarVentasDelDia = async () => {
    try {
      const ventas = await window.electron.getVentasPorPeriodo('diario');
      console.log('Ventas del día:', ventas);

      // Calcular el total de las ventas
      const total = ventas.reduce((acc, venta) => acc + venta.monto, 0);

      setVentas(ventas);
      setTotalVentas(total.toFixed(2)); // Actualizar el estado con el total formateado a dos decimales
      setError(''); // Limpiar errores si la carga es exitosa
    } catch (error) {
      console.error('Error al cargar las ventas del día:', error);
      setError('Hubo un problema al cargar las ventas del día. Intenta nuevamente.');
    }
  };

  const generarCorte = async () => {
    try {
      const nombreNegocio = localStorage.getItem('nombreNegocio') || 'Negocio';

      const { success, pdfPath, message } = await window.electron.generarCorte(tipoCorte, nombreNegocio);

      if (!success) {
        setMensaje(message || 'Hubo un error al generar el corte. Intenta nuevamente.');
        return;
      }

      setPdfPath(pdfPath);
      setMensaje(`Corte generado correctamente. El archivo se guardó en:\n${pdfPath}`);
    } catch (error) {
      console.error("Error al generar el corte:", error);
      setPdfPath("");
      setMensaje("Hubo un error al generar el corte. Intenta nuevamente.");
    }
  };

  const descargarPDF = () => {
    if (pdfPath) {
      window.electron.descargarPDF(pdfPath);
    }
  };

  return (
    <div className="cortes-container">
      <h2>Gestión de Cortes</h2>
      <div className="selector-corte">
        <label htmlFor="tipoCorte">Tipo de Corte:</label>
        <select id="tipoCorte" value={tipoCorte} onChange={(e) => setTipoCorte(e.target.value)}>
          <option value="diario">Diario</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
        </select>
        <button className="generar-corte-btn" onClick={generarCorte}>
          <FaFilePdf /> Generar Corte
        </button>
      </div>
      {mensaje && (
        <div className="mensaje">
          <p>{mensaje}</p>
          <button onClick={() => setMensaje("")}>Cerrar</button>
        </div>
      )}
      {error && <p className="error-message">{error}</p>} {/* Mostrar mensaje de error si ocurre */}
      <div className="resumen-ventas">
        <h2>Ventas del Día</h2>
        <p>Total Ventas: Q{totalVentas}</p> {/* Mostrar el total con el símbolo de la moneda */}
        {ventas.length === 0 ? (
          <p>No hay ventas disponibles para el día de hoy.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((venta, index) => (
                <tr key={index}>
                  <td>{venta.fecha_hora}</td>
                  <td>{venta.nombre}</td>
                  <td>{venta.cantidad}</td>
                  <td>Q{venta.monto.toFixed(2)}</td> {/* Formatear el monto a dos decimales */}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pdfPath && (
        <div className="cortes-pdf">
          <button className="descargar-pdf-btn" onClick={() => window.electron.abrirPDF(pdfPath)}>
            Descargar PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default Cortes;