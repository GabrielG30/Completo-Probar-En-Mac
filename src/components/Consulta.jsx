import React, { useState } from "react";
import { useInventario } from "./InventarioContext";
import "./Consulta.css"; // Importa los estilos
import BarcodeScannerComponent from "react-qr-barcode-scanner"; // Librería para escaneo de código de barras

const Consulta = () => {
  const { inventario } = useInventario();
  const [codigoBuscar, setCodigoBuscar] = useState("");
  const [productoEncontrado, setProductoEncontrado] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Buscar producto por código
  const handleSearchProduct = () => {
    const cleanedCodigo = codigoBuscar.trim().toLowerCase();

    const producto = inventario.find(item => {
      const itemCodigo = String(item.codigo).trim().toLowerCase();
      return itemCodigo === cleanedCodigo;
    });

    if (producto) {
      setProductoEncontrado(producto);
      setIsModalOpen(true); // Mostrar el modal con la info del producto
    } else {
      alert("Producto no encontrado");
    }
  };

  // Cerrar la ventana emergente
  const closeModal = () => {
    setProductoEncontrado(null);
    setIsModalOpen(false);
  };

  return (
    <div className="consulta-container dark-mode">
      <div className="consulta-box">
        <h2 className="consulta-title">Buscar Producto</h2>

        {/* Sección de escaneo de código de barras */}
        <BarcodeScannerComponent
          onUpdate={(err, result) => {
            if (result) {
              setCodigoBuscar(result.text); // Actualizar el código con lo escaneado
              handleSearchProduct(); // Realizar la búsqueda cuando se escanea un producto
            }
          }}
          width="100%"
          height={300}
          style={{ marginBottom: "20px", backgroundColor: "#f0f0f0" }}
        />

        {/* Input manual para código de barras */}
        <div className="input-container">
          <input
            type="text"
            placeholder="Escanea o ingresa el código"
            value={codigoBuscar}
            onChange={(e) => setCodigoBuscar(e.target.value)}
          />
          <button onClick={handleSearchProduct}>Buscar</button>
        </div>

        {/* Modal de producto encontrado */}
        {isModalOpen && productoEncontrado && (
          <div className="popup-consulta">
            <div className="popup-content">
              <span className="close" onClick={closeModal}>&times;</span>
              <h3>Información del Producto</h3>
              <p><strong>Nombre:</strong> {productoEncontrado.nombre}</p>
              <p><strong>Código:</strong> {productoEncontrado.codigo}</p>
              <p><strong>Precio:</strong> Q{productoEncontrado.precio}</p>
              <p><strong>Stock:</strong> {productoEncontrado.stock}</p>
              {productoEncontrado.imagen && (
                <div className="image-preview">
                  <img
                    src={productoEncontrado.imagen}
                    alt="Imagen del producto"
                    style={{ width: "200px", height: "200px", objectFit: "cover" }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Consulta;
