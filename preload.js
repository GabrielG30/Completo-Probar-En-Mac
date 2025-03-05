const { contextBridge, ipcRenderer } = require('electron');

// Exponemos funciones necesarias a la ventana renderizada
contextBridge.exposeInMainWorld('electron', {
  // Función para leer el inventario desde la base de datos
  readInventario: () => {
    return ipcRenderer.invoke('read-inventario')
      .then((data) => {
        console.log('Inventario leído:', data); // Depuración: Verifica los datos recibidos
        return data;
      })
      .catch((err) => {
        console.error('Error al leer el inventario:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Función para insertar productos en el inventario
  insertInventario: (productos) => {
    if (!Array.isArray(productos)) {
      console.error('Error: productos no es un array');
      throw new Error('El parámetro "productos" debe ser un array');
    }

    return ipcRenderer.invoke('insert-inventario', productos)
      .then((result) => {
        console.log('Productos insertados:', result); // Depuración: Verifica el resultado
        return result;
      })
      .catch((err) => {
        console.error('Error al insertar productos:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Función para eliminar todos los productos del inventario
  deleteInventario: () => {
    return ipcRenderer.invoke('delete-inventario')
      .then((result) => {
        console.log('Inventario eliminado:', result); // Depuración: Verifica el resultado
        return result;
      })
      .catch((err) => {
        console.error('Error al eliminar inventario:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Función para editar un producto del inventario
  updateInventario: (producto) => {
    if (!producto || !producto.codigo) {
      console.error('Error: producto no válido');
      throw new Error('El producto debe tener un código válido');
    }

    return ipcRenderer.invoke('update-inventario', producto)
      .then((result) => {
        console.log('Producto editado:', result); // Depuración: Verifica el resultado
        return result;
      })
      .catch((err) => {
        console.error('Error al editar producto:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Función para realizar una venta
  realizarVenta: (venta, printerName) => {
    return ipcRenderer.invoke('realizar-venta', venta, printerName)
      .then((result) => {
        console.log('Venta realizada:', result); // Depuración: Verifica el resultado
        return result;
      })
      .catch((err) => {
        console.error('Error al realizar la venta:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Función para obtener la configuración (si es necesaria)
  getConfig: () => {
    return ipcRenderer.invoke('get-config')
      .then((config) => {
        console.log('Configuración obtenida:', config); // Depuración: Verifica la configuración
        return config;
      })
      .catch((err) => {
        console.error('Error al obtener la configuración:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Nueva función para actualizar el stock
  updateStock: (codigo, cantidad) => {
    return ipcRenderer.invoke('updateStock', codigo, cantidad)
      .then((result) => {
        console.log('Stock actualizado:', result); // Depuración: Verifica el resultado
        return result;
      })
      .catch((err) => {
        console.error('Error al actualizar el stock:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },

  // Obtener la lista de impresoras
  getPrinters: () => {
    return ipcRenderer.invoke('get-printers')
      .then((printers) => {
        console.log('Impresoras obtenidas:', printers); // Depuración: Verifica la lista de impresoras
        return printers;
      })
      .catch((err) => {
        console.error('Error al obtener las impresoras:', err); // Manejo de errores
        throw err; // Propaga el error para que el renderizado lo maneje
      });
  },
});