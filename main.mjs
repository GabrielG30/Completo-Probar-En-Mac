import { app, BrowserWindow, ipcMain } from 'electron';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx'; // Para leer archivos Excel
import fs from 'fs'; // Para manejar el sistema de archivos
import pdfToPrinter from 'pdf-to-printer'; // Importa el módulo como un paquete completo
import puppeteer from "puppeteer";

const { getPrinters, print } = pdfToPrinter; // Extrae las funciones necesarias

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
    icon: path.join(__dirname, 'public', '1.ico'),
    title: 'Farmacia R&R',
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
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html')); // Producción
  }
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

// Obtener lista de impresoras
ipcMain.handle('get-printers', async () => {
  try {
    console.log('Intentando obtener la lista de impresoras...');
    const printers = await getPrinters(); // Obtener la lista de impresoras
    console.log('Lista de impresoras obtenida:', printers);
    return printers;
  } catch (error) {
    console.error('Error al obtener las impresoras:', error.message);
    console.error('Error stack trace:', error.stack);
    return [];
  }
});

const imprimirFactura = async (factura, printerName) => {
  try {
    console.log("📄 Generando factura en PDF...");

    // Crear un navegador sin cabeza (headless)
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Ajustar el viewport para evitar margen superior
    await page.setViewport({
      width: 192, // 48mm ≈ 192px a 96 DPI
      height: 1 // Altura mínima para forzar la impresión en la parte superior
    });

    // Construir el HTML de la factura con margen CERO
    const facturaHTML = `
      <div style="
        font-family: Arial, sans-serif;
        font-size: 12px;
        width: 48mm;
        padding: 0;
        margin: 0;
        line-height: 1.2;
        display: inline-block;
        clip-path: inset(0px 0px 0px 0px);
      ">
        <h3 style="text-align: center; margin: 0; padding: 0;">Farmacia R&R</h3>
        <p style="text-align: center; margin: 0;">Fecha: ${new Date().toLocaleString()}</p>
        <hr style="margin: 1px 0;" />
        <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin: 0;">
          <thead>
            <tr>
              <th style="text-align: left;">Producto</th>
              <th style="text-align: center;">Cant</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${factura.productos.map(p => `
              <tr>
                <td>${p.nombre}</td>
                <td style="text-align: center;">${p.stock}</td>
                <td style="text-align: right;">Q${(p.precio * p.stock).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <hr style="margin: 1px 0;" />
        <p>Total: Q${factura.total.toFixed(2)}</p>
        <p>Pago: Q${factura.pago.toFixed(2)}</p>
        <hr style="margin: 1px 0;" />
        <p style="text-align: center;">¡Gracias por su compra!</p>
      </div>
    `;

    // Cargar el HTML en Puppeteer
    await page.setContent(facturaHTML, { waitUntil: "domcontentloaded" });

    // Ruta del archivo PDF
    const pdfPath = path.join(process.cwd(), "factura.pdf");

    // Generar el PDF sin márgenes extra
    await page.pdf({
      path: pdfPath,
      width: "48mm", // Ancho exacto de la impresora térmica
      height: "auto", // La altura se ajusta al contenido
      margin: { top: "10mm", right: "0mm", bottom: "0mm", left: "0mm" }, // ❌ ELIMINA márgenes extra
      printBackground: true,
      preferCSSPageSize: true // ❗ Importante para evitar márgenes adicionales
    });

    // Cerrar Puppeteer
    await browser.close();

    console.log(`✅ PDF generado correctamente: ${pdfPath}`);

    // Enviar el PDF a la impresora sin reducir el tamaño
    await pdfToPrinter.print(pdfPath, {
      printer: printerName,
      options: ["-o fit-to-page", "-o media=Custom.48x297mm"]
    });

    console.log("✅ Factura enviada a la impresora térmica sin margen superior.");
  } catch (error) {
    console.error("❌ Error al intentar imprimir:", error.message);
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
    await imprimirFactura({ productos: venta.productos, total, pago: venta.pagoConEfectivo, vuelto, metodoPago: venta.metodoPago }, printerName);

    return { total, vuelto };
  } catch (error) {
    console.error('Error al realizar la venta:', error.message);
    throw new Error('Error al realizar la venta. Intenta nuevamente.');
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

// Manejador de IPC para actualizar un producto del inventario
ipcMain.handle('update-inventario', async (event, producto) => {
  return new Promise((resolve, reject) => {
    const { codigo, nombre, precio, stock } = producto;
    db.run(
      'UPDATE inventario SET nombre = ?, precio = ?, stock = ? WHERE codigo = ?',
      [nombre, precio, stock, codigo],
      function (err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          resolve('No se encontró el producto');
        } else {
          resolve('Producto actualizado correctamente');
        }
      }
    );
  });
});

// Manejador de IPC para eliminar un producto del inventario
ipcMain.handle('delete-producto', async (event, codigo) => {
  console.log(`Eliminando producto con código: ${codigo}`);
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM inventario WHERE codigo = ?', [codigo], function (err) {
      if (err) {
        console.error('Error al eliminar el producto:', err.message);
        reject(err);
      } else if (this.changes === 0) {
        console.log('No se encontró el producto:', codigo);
        resolve('No se encontró el producto');
      } else {
        console.log(`Producto con código ${codigo} eliminado con éxito.`);
        resolve('Producto eliminado con éxito');
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});