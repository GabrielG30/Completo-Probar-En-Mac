const { contextBridge, ipcRenderer } = require('electron');

// Función genérica para invocar métodos de IPC con manejo de errores
const invokeIPC = async (channel, ...args) => {
  try {
    console.log(`Invoking IPC channel: ${channel}`, args); // Depuración: Verifica la llamada
    const result = await ipcRenderer.invoke(channel, ...args);
    console.log(`Result from IPC channel ${channel}:`, result); // Depuración: Verifica el resultado
    return result;
  } catch (err) {
    console.error(`Error in IPC channel ${channel}:`, err); // Manejo de errores
    throw err; // Propaga el error para que el renderizado lo maneje
  }
};

// Exponemos funciones necesarias a la ventana renderizada
contextBridge.exposeInMainWorld('electron', {
  // Función para leer el inventario desde la base de datos
  readInventario: () => invokeIPC('read-inventario'),

  // Función para insertar productos en el inventario
  insertInventario: (productos) => {
    if (!Array.isArray(productos)) {
      console.error('Error: productos no es un array');
      throw new Error('El parámetro "productos" debe ser un array');
    }
    return invokeIPC('insert-inventario', productos);
  },

  // Función para eliminar todos los productos del inventario
  deleteInventario: () => invokeIPC('delete-inventario'),

  // Función para editar un producto del inventario
  updateInventario: (producto) => {
    if (!producto || !producto.codigo) {
      console.error('Error: producto no válido');
      throw new Error('El producto debe tener un código válido');
    }
    return invokeIPC('update-inventario', producto);
  },

  // Función para realizar una venta
  realizarVenta: (venta, printerName) => {
    if (!venta || !printerName) {
      console.error('Error: venta o printerName no válidos');
      throw new Error('La venta y el nombre de la impresora son requeridos');
    }
    return invokeIPC('realizar-venta', venta, printerName);
  },

  // Función para obtener la configuración (si es necesaria)
  getConfig: () => invokeIPC('get-config'),

  // Función para actualizar el stock
  updateStock: (codigo, cantidad) => {
    if (!codigo || !cantidad) {
      console.error('Error: codigo o cantidad no válidos');
      throw new Error('El código y la cantidad son requeridos');
    }
    return invokeIPC('updateStock', codigo, cantidad);
  },

  // Obtener la lista de impresoras
  getPrinters: () => invokeIPC('get-printers'),
});