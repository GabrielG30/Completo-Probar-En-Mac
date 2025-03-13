import React, { useState, useEffect, useRef } from "react";
import { useInventario } from "./InventarioContext";
import "./Consulta.css"; // Importa los estilos

const Consulta = () => {
  const { inventario } = useInventario();
  const [codigoBuscar, setCodigoBuscar] = useState("");
  const [productoEncontrado, setProductoEncontrado] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Referencia para el campo de búsqueda
  const searchInputRef = useRef(null);

  // Enfocar automáticamente el campo de búsqueda al cargar el componente
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Buscar producto por código
  const handleSearchProduct = (codigo) => {
    const cleanedCodigo = codigo.trim().toLowerCase();

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

    setCodigoBuscar(""); // Limpiar la barra de búsqueda después de buscar
    if (searchInputRef.current) {
      searchInputRef.current.focus(); // Enfocar nuevamente el campo de búsqueda
    }
  };

  // Cerrar la ventana emergente
  const closeModal = () => {
    setProductoEncontrado(null);
    setIsModalOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus(); // Enfocar nuevamente el campo de búsqueda al cerrar el modal
    }
  };

  // Manejar la tecla "Enter" en el campo de búsqueda
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearchProduct(codigoBuscar);
    }
  };

  return (
    <div className="consulta-container dark-mode">
      <div className="consulta-box">
        <h2 className="consulta-title">Buscar Producto</h2>

        {/* Input manual para código de barras */}
        <div className="input-container">
          <input
            type="text"
            placeholder="Escanea o ingresa el código"
            value={codigoBuscar}
            onChange={(e) => setCodigoBuscar(e.target.value)}
            onKeyPress={handleKeyPress} // Manejar la tecla "Enter"
            ref={searchInputRef} // Referencia para enfocar automáticamente
            autoFocus // Enfocar automáticamente
          />
          <button onClick={() => handleSearchProduct(codigoBuscar)}>Buscar</button>
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
