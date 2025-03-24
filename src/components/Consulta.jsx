import React, { useState, useEffect, useRef } from "react";
import { useInventario } from "./InventarioContext";
import "./Consulta.css"; // Importa los estilos

const Consulta = () => {
  const { inventario } = useInventario();
  const [busqueda, setBusqueda] = useState(""); // Estado para la búsqueda
  const [productosEncontrados, setProductosEncontrados] = useState([]); // Lista de productos encontrados
  const [isModalOpen, setIsModalOpen] = useState(false); // Estado para el modal
  const [productoSeleccionado, setProductoSeleccionado] = useState(null); // Producto seleccionado para el modal

  // Referencia para el campo de búsqueda
  const searchInputRef = useRef(null);

  // Enfocar automáticamente el campo de búsqueda al cargar el componente
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Buscar productos mientras el usuario escribe
  useEffect(() => {
    if (busqueda.trim()) {
      const cleanedBusqueda = busqueda.trim().toLowerCase();

      const productosFiltrados = inventario.filter(item => {
        const itemCodigo = String(item.codigo).trim().toLowerCase();
        const itemNombre = item.nombre.trim().toLowerCase();
        return itemCodigo.includes(cleanedBusqueda) || itemNombre.includes(cleanedBusqueda);
      });

      setProductosEncontrados(productosFiltrados);
    } else {
      setProductosEncontrados([]); // Si no hay búsqueda, limpia la lista
    }
  }, [busqueda, inventario]);

  // Manejar la tecla "Enter" en el campo de búsqueda
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      setBusqueda(""); // Limpiar el campo de búsqueda al presionar Enter
      if (searchInputRef.current) {
        searchInputRef.current.focus(); // Enfocar nuevamente el campo de búsqueda
      }
    }
  };

  // Abrir el modal con la información del producto seleccionado
  const openModal = (producto) => {
    setProductoSeleccionado(producto);
    setIsModalOpen(true);
  };

  // Cerrar la ventana emergente
  const closeModal = () => {
    setProductoSeleccionado(null);
    setIsModalOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus(); // Enfocar nuevamente el campo de búsqueda al cerrar el modal
    }
  };

  return (
    <div className="consulta-container dark-mode">
      <div className="consulta-box">
        <h2 className="consulta-title">Buscar Producto</h2>

        {/* Input manual para código de barras o nombre */}
        <div className="input-container">
          <input
            type="text"
            placeholder="Escanea o ingresa el código o nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyPress={handleKeyPress} // Manejar la tecla "Enter"
            ref={searchInputRef} // Referencia para enfocar automáticamente
            autoFocus // Enfocar automáticamente
          />
        </div>

        {/* Lista de productos encontrados */}
        {productosEncontrados.length > 0 && (
          <div className="productos-lista">
            {productosEncontrados.map((producto) => (
              <div
                key={producto.codigo}
                className="producto-item"
                onClick={() => openModal(producto)} // Abrir modal al hacer clic en un producto
              >
                <p><strong>Nombre:</strong> {producto.nombre}</p>
                <p><strong>Código:</strong> {producto.codigo}</p>
                <p><strong>Precio:</strong> Q{producto.precio}</p>
                <p><strong>Stock:</strong> {producto.stock}</p>
                <p><strong>Estante:</strong> {producto.estante}</p> {/* Mostrar el estante */}
              </div>
            ))}
          </div>
        )}

        {/* Modal de producto seleccionado */}
        {isModalOpen && productoSeleccionado && (
          <div className="popup-consulta">
            <div className="popup-content">
              <span className="close" onClick={closeModal}>&times;</span>
              <h3>Información del Producto</h3>
              <p><strong>Nombre:</strong> {productoSeleccionado.nombre}</p>
              <p><strong>Código:</strong> {productoSeleccionado.codigo}</p>
              <p><strong>Precio:</strong> Q{productoSeleccionado.precio}</p>
              <p><strong>Stock:</strong> {productoSeleccionado.stock}</p>
              <p><strong>Estante:</strong> {productoSeleccionado.estante}</p> {/* Mostrar el estante */}
              {productoSeleccionado.imagen && (
                <div className="image-preview">
                  <img
                    src={productoSeleccionado.imagen}
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