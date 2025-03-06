import { app, BrowserWindow, ipcMain } from 'electron';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx'; // Para leer archivos Excel
import fs from 'fs'; // Para manejar el sistema de archivos
import printer from 'node-printer'; // Para imprimir en una impresora térmica

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Obtener la ruta de la carpeta de datos del usuario
const userDataPath = app.getPath('userData');

// Ruta de la base de datos
const dbPath = path.join(userDataPath, 'inventario.db');
console.log('Ruta de la base de datos:', dbPath); // Verificar la ruta de la base de datos

// Verificar si la carpeta 'userData' existe y crearla si no
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Función para crear la base de datos
const createDatabase = () => {
  console.log('Conectando con la base de datos...');
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error al abrir la base de datos:', err.message);
    } else {
      console.log('Base de datos conectada.');

      // Crear la tabla si no existe
      db.run(`
        CREATE TABLE IF NOT EXISTS inventario (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          codigo TEXT NOT NULL UNIQUE,
          precio REAL NOT NULL,
          stock INTEGER NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error al crear la tabla:', err.message);
        } else {
          console.log("Tabla 'inventario' creada o ya existe.");
        }
      });
    }
  });
  return db;
};

const db = createDatabase();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'public', '1.icns'),
    title: 'Mi Punto de Venta',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  console.log(__dirname);
  console.log(`file://${path.join(__dirname, 'dist/index.html')}`);

  // Cargar la aplicación en desarrollo o producción
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173'); // Desarrollo
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html')); // Producción
  }

  // mainWindow.webContents.openDevTools(); // Descomenta para abrir las herramientas de desarrollo

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });
}

// Leer inventario
ipcMain.handle('read-inventario', async () => {
  console.log('Leyendo inventario desde la base de datos...');
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM inventario', (err, rows) => {
      if (err) {
        console.error('Error al leer la base de datos:', err.message);
        reject(err);
      } else {
        console.log(`Se encontraron ${rows.length} registros en la tabla 'inventario'.`);
        resolve(rows);
      }
    });
  });
});

// Insertar o actualizar inventario desde Excel
ipcMain.handle('importar-excel', async (event, filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

  const productos = jsonData.map(producto => ({
    nombre: producto.nombre,
    codigo: producto.codigo,
    precio: producto.precio,
    stock: producto.stock
  }));

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO inventario (nombre, codigo, precio, stock) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET 
        nombre = excluded.nombre,
        precio = excluded.precio,
        stock = excluded.stock;
      `);

      let productosInsertados = 0;
      let productosOmitidos = 0;

      productos.forEach((producto) => {
        if (producto.codigo && String(producto.codigo).trim() !== '') {
          stmt.run(
            producto.nombre,
            producto.codigo,
            producto.precio,
            producto.stock,
            (err) => {
              if (err) {
                console.error('Error al insertar producto:', err.message);
              }
            }
          );
          productosInsertados++;
        } else {
          productosOmitidos++;
        }
      });

      stmt.finalize((err) => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          db.run('COMMIT');
          resolve({ productosInsertados, productosOmitidos });
        }
      });
    });
  });
});

// Eliminar inventario
ipcMain.handle('delete-inventario', async () => {
  console.log('Eliminando inventario desde la base de datos...');
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM inventario', (err) => {
      if (err) {
        console.error('Error al eliminar inventario:', err.message);
        reject(err);
      } else {
        console.log('Inventario eliminado con éxito.');
        resolve('Inventario eliminado con éxito');
      }
    });
  });
});

// Actualizar inventario
ipcMain.handle('updateStock', async (event, codigo, cantidad) => {
  console.log('Actualizando stock para producto:', codigo, 'Cantidad:', cantidad);
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE inventario SET stock = stock - ? WHERE codigo = ? AND stock >= ?',
      [cantidad, codigo, cantidad],
      function (err) {
        if (err) {
          console.error('Error al actualizar el stock:', err.message);
          reject(err);
        } else if (this.changes === 0) {
          console.log('No se encontró el producto o stock insuficiente:', codigo);
          resolve('No se encontró el producto o stock insuficiente');
        } else {
          console.log(`Stock actualizado para el producto con código ${codigo}`);
          resolve('Stock actualizado con éxito');
        }
      }
    );
  });
});

// Función para imprimir factura
const imprimirFactura = (factura, printerName) => {
  const facturaFormateada = `
----------------------------------------
          Farmacia R&R
----------------------------------------
Fecha: ${new Date().toLocaleString()}
----------------------------------------
Producto           Cant.  Precio  Total
----------------------------------------
${factura.productos.map(p => 
  `${p.nombre.padEnd(20)} ${p.stock.toString().padStart(3)}     Q${p.precio.toFixed(2).padStart(5)}   Q${(p.precio * p.stock).toFixed(2).padStart(5)}`
).join('\n')}
----------------------------------------
Total: Q${factura.total.toFixed(2)}
Pago: Q${factura.pago.toFixed(2)}
Vuelto: Q${factura.vuelto.toFixed(2)}
----------------------------------------
Método de pago: ${factura.metodoPago === "tarjeta" ? "Tarjeta (+6%)" : "Efectivo"}
----------------------------------------
¡Gracias por su compra!
----------------------------------------
`;

  try {
    printer.printDirect({
      data: facturaFormateada,
      printer: printerName,
      type: 'RAW',
      success: (jobID) => {
        console.log('Factura enviada a la impresora térmica. Job ID:', jobID);
      },
      error: (err) => {
        console.error('Error al imprimir:', err);
      },
    });
  } catch (error) {
    console.error('Error al intentar imprimir:', error.message);
  }
};

// Realizar venta
ipcMain.handle('realizar-venta', async (event, venta, printerName) => {
  console.log('Iniciando proceso de venta...');
  console.log('Productos en la venta:', venta.productos);

  try {
    for (const producto of venta.productos) {
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT stock FROM inventario WHERE codigo = ?', [producto.codigo], (err, row) => {
          if (err) {
            reject(err);
          } else {
            console.log('Resultado de la consulta:', row); // Verificar el resultado de la consulta
            resolve(row);
          }
        });
      });

      if (!row) {
        throw new Error(`Producto con código ${producto.codigo} no encontrado.`);
      }

      if (row.stock < producto.stock) {
        throw new Error(`Stock insuficiente para el producto ${producto.codigo}. Stock actual: ${row.stock}, Stock requerido: ${producto.stock}`);
      }
    }

    let total = venta.productos.reduce((acc, producto) => acc + producto.precio * producto.stock, 0);
    console.log('Total calculado:', total);

    if (venta.pagoConTarjeta) {
      total *= 1.06; // 6% adicional
      console.log('Total con tarjeta (6% adicional):', total);
    }

    const vuelto = venta.pagoConEfectivo - total;
    console.log('Vuelto calculado:', vuelto);

    const stmt = db.prepare(`
      UPDATE inventario 
      SET stock = stock - ?
      WHERE codigo = ?
    `);

    venta.productos.forEach((producto) => {
      console.log(`Actualizando stock para producto ${producto.codigo}: stock actual - ${producto.stock}`);
      stmt.run(producto.stock, producto.codigo, (err) => {
        if (err) {
          console.error(`Error al actualizar stock para producto ${producto.codigo}:`, err.message);
        } else {
          console.log(`Stock actualizado para producto ${producto.codigo}`);
        }
      });
    });

    stmt.finalize();

    console.log('Intentando imprimir factura...');
    imprimirFactura({ productos: venta.productos, total, pago: venta.pagoConEfectivo, vuelto, metodoPago: venta.metodoPago }, printerName);

    return { total, vuelto };
  } catch (error) {
    console.error('Error al realizar la venta:', error.message);
    throw new Error('Error al realizar la venta. Intenta nuevamente.');
  }
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Insertar inventario
ipcMain.handle('insert-inventario', async (event, productos) => {
  console.log('Insertando productos en la base de datos...');
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO inventario (nombre, codigo, precio, stock)
      VALUES (?, ?, ?, ?)
    `);

    let productosInsertados = 0;
    let productosOmitidos = 0;

    productos.forEach((producto) => {
      if (producto.codigo && String(producto.codigo).trim() !== '') {
        stmt.run(
          producto.nombre,
          producto.codigo,
          producto.precio,
          producto.stock,
          (err) => {
            if (err) {
              console.error('Error al insertar producto:', err.message);
              productosOmitidos++;
            } else {
              productosInsertados++;
              console.log(`Producto insertado: ${producto.codigo}`); // Verificar inserción de productos
            }
          }
        );
      } else {
        productosOmitidos++;
      }
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('Error al finalizar la inserción:', err.message);
        reject(err);
      } else {
        console.log(`Productos insertados: ${productosInsertados}, Productos omitidos: ${productosOmitidos}`);
        resolve({ productosInsertados, productosOmitidos });
      }
    });
  });
});

// Actualizar inventario (editar producto)
ipcMain.handle('update-inventario', async (event, producto) => {
  console.log('Actualizando producto:', producto.codigo);
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE inventario
      SET nombre = ?, precio = ?, stock = ?
      WHERE codigo = ?
    `);

    stmt.run(producto.nombre, producto.precio, producto.stock, producto.codigo, function(err) {
      if (err) {
        console.error('Error al actualizar producto:', err.message);
        reject(err);
      } else {
        console.log(`Producto con código ${producto.codigo} actualizado.`);
        resolve({ mensaje: 'Producto actualizado correctamente.' });
      }
    });

    stmt.finalize();
  });
});