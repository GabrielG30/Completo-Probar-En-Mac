import React, { createContext, useState, useContext, useEffect } from "react";

// Crear el contexto
const InventarioContext = createContext();

// Proveedor del contexto
export const InventarioProvider = ({ children }) => {
  const [inventario, setInventario] = useState([]);
  const [error, setError] = useState(null); // Estado para manejar errores

  // 📌 Cargar inventario desde la base de datos SQLite
  const cargarInventarioDesdeDB = async () => {
    try {
      const data = await window.electron.readInventario(); // Llamada a la API de Electron
      console.log("Inventario cargado desde la DB:", data); // Verificación
      setInventario(data);
    } catch (error) {
      console.error("Error al cargar inventario desde la DB:", error);
      setError("No se pudo cargar el inventario.");
    }
  };

  // 📌 Guardar cambios en la base de datos SQLite
  const guardarInventario = async (nuevoInventario) => {
    try {
      await window.electron.updateInventario(nuevoInventario);
      cargarInventarioDesdeDB(); // Recargar desde la BD después de actualizar
    } catch (error) {
      console.error("Error al guardar inventario:", error);
      setError("No se pudo guardar el inventario.");
    }
  };

  // 📌 Descontar stock en SQLite
  const descontarStock = async (codigo, cantidadVendida) => {
    try {
      // Buscar el producto en el inventario actual
      const producto = inventario.find(item => item.codigo === codigo);

      if (!producto) {
        console.error("Producto no encontrado");
        setError("Producto no encontrado.");
        return;
      }

      // Comprobar si la cantidad es válida
      if (producto.cantidad === undefined || producto.cantidad < 0) {
        console.error("Cantidad no válida");
        setError("Cantidad no válida para descontar.");
        return;
      }

      // Calcular el nuevo stock después de la venta
      const nuevoStock = producto.cantidad - cantidadVendida;

      // Comprobar si hay suficiente stock
      if (nuevoStock < 0) {
        console.error("No hay suficiente stock para realizar la venta");
        setError("No hay suficiente stock.");
        return;
      }

      console.log(`Descontando ${cantidadVendida} unidades del producto con código: ${codigo}`);

      // Actualizar localmente el inventario antes de llamar a la base de datos
      setInventario(prevInventario => prevInventario.map(item => 
        item.codigo === codigo ? { ...item, cantidad: nuevoStock } : item
      ));

      // Actualizar el stock en la base de datos
      await window.electron.updateInventario({ codigo, stock: nuevoStock });

      // Recargar el inventario desde la base de datos después de actualizar el stock
      cargarInventarioDesdeDB();
    } catch (error) {
      console.error("Error al descontar stock:", error);
      setError("Error al descontar el stock.");
    }
  };

  // ⚡ Cargar inventario automáticamente cuando el contexto se monte
  useEffect(() => {
    cargarInventarioDesdeDB();
  }, []); // Solo se ejecuta una vez al montar el componente

  // Función para manejar el cierre de mensajes de error
  const clearError = () => setError(null);

  return (
    <InventarioContext.Provider
      value={{
        inventario,
        setInventario,
        guardarInventario,
        descontarStock,
        error,
        clearError, // Función para limpiar el error
      }}
    >
      {children}
    </InventarioContext.Provider>
  );
};

// Hook personalizado para usar el inventario en cualquier parte
export const useInventario = () => {
  const context = useContext(InventarioContext);
  if (!context) {
    throw new Error("useInventario debe ser usado dentro de un InventarioProvider");
  }
  return context;
};
