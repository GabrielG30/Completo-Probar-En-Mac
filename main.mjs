import { app, BrowserWindow, ipcMain } from 'electron';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx'; // Para leer archivos Excel
import fs from 'fs'; // Para manejar el sistema de archivos
import puppeteer from "puppeteer";
import pdfToPrinter from 'pdf-to-printer'; // Para imprimir PDFs
import { format } from 'date-fns';
import { dialog, shell } from 'electron';

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

      // --- Crear tabla inventario ---
      db.run(`
        CREATE TABLE IF NOT EXISTS inventario (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          codigo TEXT NOT NULL UNIQUE,
          precio REAL NOT NULL,
          stock INTEGER NOT NULL,
          estante TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Error al crear la tabla inventario:', err.message);
        } else {
          console.log("Tabla 'inventario' lista.");
        }
      });

      // --- Crear tabla ventas ---
      db.run(`
        CREATE TABLE IF NOT EXISTS ventas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha_hora TEXT NOT NULL,
          codigo_producto TEXT NOT NULL,
          cantidad INTEGER NOT NULL,
          monto REAL NOT NULL,
          FOREIGN KEY (codigo_producto) REFERENCES inventario(codigo)
        )
      `, (err) => {
        if (err) {
          console.error('Error al crear la tabla ventas:', err.message);
        } else {
          console.log("Tabla 'ventas' lista.");
        }
      });

      // --- Crear tabla cortes ---
      db.run(`
        CREATE TABLE IF NOT EXISTS cortes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha_inicio TEXT NOT NULL,
          fecha_fin TEXT NOT NULL,
          total_productos_vendidos INTEGER NOT NULL,
          total_monto REAL NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error al crear la tabla cortes:', err.message);
        } else {
          console.log("Tabla 'cortes' lista.");
        }
      });

      // Agregar la columna 'estante' si no existe
      db.run(`
        ALTER TABLE inventario ADD COLUMN estante TEXT
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error al agregar la columna estante:', err.message);
        } else {
          console.log("Columna 'estante' agregada o ya existe.");
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
    stock: producto.stock,
    estante: producto.estante
  }));

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO inventario (nombre, codigo, precio, stock, estante) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET 
        nombre = excluded.nombre,
        precio = excluded.precio,
        stock = excluded.stock,
        estante = excluded.estante;
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
            producto.estante,
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
    const printers = await pdfToPrinter.getPrinters(); // Descomentado para obtener la lista de impresoras
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

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setViewport({
      width: 192, // 48mm ≈ 192px a 96 DPI
      height: 1080 // Altura fija para evitar problemas con "auto"
    });

    const facturaHTML = `
      <div style="
        font-family: Arial, sans-serif;
        font-size: 12px;
        width: 48mm;
        padding: 0;
        margin: 0;
        line-height: 1.2;
        display: inline-block;
        text-align: center;
      ">
        ${factura.nombreNegocio ? `<h3 style="margin: 0; padding: 0;">${factura.nombreNegocio}</h3>` : ''}
        <p style="margin: 0;">Fecha: ${factura.fecha}</p>
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
                <td style="text-align: center;">${p.cantidad}</td>
                <td style="text-align: right;">Q${(p.precio * p.cantidad).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <hr style="margin: 1px 0;" />
        <p>Total: Q${factura.total.toFixed(2)}</p>
        <p>Pago: Q${factura.pago.toFixed(2)}</p>
        <p>Vuelto: Q${factura.vuelto.toFixed(2)}</p>
        <hr style="margin: 1px 0;" />
        <p style="text-align: center;">¡Gracias por su compra!</p>
      </div>
    `;

    await page.setContent(facturaHTML, { waitUntil: "domcontentloaded" });

    const pdfPath = path.join(process.cwd(), "factura.pdf");

    // Generar el PDF con un tamaño fijo
    await page.pdf({
      path: pdfPath,
      width: "48mm",
      height: "297mm", // Altura fija para evitar problemas con "auto"
      margin: { top: "10mm", right: "0mm", bottom: "10mm", left: "0mm" },
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();

    console.log(`✅ PDF generado correctamente: ${pdfPath}`);

    // Enviar el PDF a la impresora
    await pdfToPrinter.print(pdfPath, {
      printer: printerName,
      options: ["-o fit-to-page", "-o media=Custom.48x297mm"]
    });

    console.log("✅ Factura enviada a la impresora correctamente.");
  } catch (error) {
    console.error("❌ Error al intentar imprimir:", error.message);
  }
};

// Realizar venta
ipcMain.handle('realizar-venta', async (event, venta, printerName) => {
  console.log('Iniciando proceso de venta...');

  try {
    if (!venta || !venta.productos || venta.productos.length === 0) {
      throw new Error('La venta no es válida');
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const fechaHora = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      const ventaStmt = db.prepare(`
        INSERT INTO ventas (fecha_hora, codigo_producto, cantidad, monto)
        VALUES (?, ?, ?, ?)
      `);

      venta.productos.forEach((producto) => {
        ventaStmt.run(fechaHora, producto.codigo, producto.cantidad, producto.precio * producto.cantidad, (err) => {
          if (err) {
            console.error(`Error al insertar venta del producto ${producto.codigo}:`, err.message);
          }
        });
      });
      ventaStmt.finalize();

      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          console.error('Error al realizar la transacción:', err.message);
          throw new Error('Error al realizar la venta. Intenta nuevamente.');
        } else {
          console.log('Transacción completada con éxito.');
        }
      });
    });

    // Agregar la fecha al objeto venta
    venta.fecha = new Date().toLocaleString();

    // Imprimir factura
    if (printerName) {
      await imprimirFactura(venta, printerName);
    }

    return { success: true };
  } catch (error) {
    console.error('Error al realizar la venta:', error.message);
    throw new Error(error.message || 'Error al realizar la venta. Intenta nuevamente.');
  }
});

// Insertar inventario
ipcMain.handle('insert-inventario', async (event, productos) => {
  console.log('Insertando productos en la base de datos...');
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO inventario (nombre, codigo, precio, stock, estante)
      VALUES (?, ?, ?, ?, ?)
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
          producto.estante,
          (err) => {
            if (err) {
              console.error('Error al insertar producto:', err.message);
              productosOmitidos++;
            } else {
              productosInsertados++;
              console.log(`Producto insertado: ${producto.codigo}`);
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
    const { codigo, nombre, precio, stock, estante } = producto;
    db.run(
      'UPDATE inventario SET nombre = ?, precio = ?, stock = ?, estante = ? WHERE codigo = ?',
      [nombre, precio, stock, estante, codigo],
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

// Función para generar PDF de corte
const generarPDFCorte = async (ventas, tipo) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Obtener el nombre del negocio desde localStorage
    const nombreNegocio = "PDF"; // Cambiar por el valor dinámico si se pasa desde el frontend

    // Formatear la fecha actual
    const fechaActual = format(new Date(), 'dd-MM-yyyy');

    // Generar el contenido HTML para el PDF
    const htmlContent = `
      <h1 style="text-align: center;">Corte ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</h1>
      <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse; text-align: center;">
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          ${ventas.map((venta) => `
            <tr>
              <td>${venta.fecha_hora}</td>
              <td>${venta.nombre}</td>
              <td>${venta.cantidad}</td>
              <td>Q${venta.monto.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <h2 style="text-align: right;">Total: Q${ventas.reduce((acc, venta) => acc + venta.monto, 0).toFixed(2)}</h2>
    `;

    await page.setContent(htmlContent);

    // Ruta para guardar el PDF en el escritorio
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar Corte',
      defaultPath: `${nombreNegocio}_${tipo}_${fechaActual}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled) {
      console.log('El usuario canceló la operación.');
      return { success: false, message: 'Operación cancelada por el usuario.' };
    }

    if (!filePath) {
      console.error('No se seleccionó una ruta para guardar el archivo.');
      return { success: false, message: 'No se seleccionó una ruta para guardar el archivo.' };
    }

    // Usar filePath directamente
    await page.pdf({ path: filePath, format: 'A4' });
    await browser.close();

    console.log(`PDF generado correctamente en: ${filePath}`);
    return { success: true, pdfPath: filePath };
  } catch (error) {
    console.error('Error al generar el PDF:', error.message);
    throw new Error('Error al generar el PDF');
  }
};

// Obtener ventas por período (día, semana, mes)
ipcMain.handle('get-ventas-por-periodo', async (event, tipo) => {
  try {
    let query = `
      SELECT ventas.fecha_hora, inventario.nombre, ventas.cantidad, ventas.monto
      FROM ventas
      INNER JOIN inventario ON ventas.codigo_producto = inventario.codigo
    `;

    let params = [];
    const hoy = new Date();

    if (tipo === 'diario') {
      const fechaHoy = hoy.toISOString().split('T')[0];
      query += ` WHERE date(ventas.fecha_hora) = ?`;
      params.push(fechaHoy);

    } else if (tipo === 'semanal') {
      let semanaAtras = new Date();
      semanaAtras.setDate(hoy.getDate() - 7);
      query += ` WHERE date(ventas.fecha_hora) BETWEEN ? AND ?`;
      params.push(semanaAtras.toISOString().split('T')[0], hoy.toISOString().split('T')[0]);

    } else if (tipo === 'mensual') {
      let mesAtras = new Date();
      mesAtras.setMonth(hoy.getMonth() - 1);
      query += ` WHERE date(ventas.fecha_hora) BETWEEN ? AND ?`;
      params.push(mesAtras.toISOString().split('T')[0], hoy.toISOString().split('T')[0]);
    }

    query += ` ORDER BY ventas.fecha_hora DESC`;

    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error obteniendo ventas:', err.message);
          reject([]);
        } else {
          resolve(rows);
        }
      });
    });
  } catch (error) {
    console.error('Error en get-ventas-por-periodo:', error.message);
    return [];
  }
});

// Generar un corte (diario, semanal, mensual)
ipcMain.handle('generar-corte', async (event, tipo) => {
  try {
    // Obtener las ventas del período
    const ventas = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT ventas.fecha_hora, inventario.nombre, ventas.cantidad, ventas.monto
        FROM ventas
        INNER JOIN inventario ON ventas.codigo_producto = inventario.codigo
        WHERE ${tipo === 'diario' ? "DATE(ventas.fecha_hora) = DATE('now')" : 
               tipo === 'semanal' ? "DATE(ventas.fecha_hora) >= DATE('now', '-7 days')" : 
               "strftime('%Y-%m', ventas.fecha_hora) = strftime('%Y-%m', 'now')"}
        `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Calcular el monto total
    const totalMonto = ventas.reduce((acc, venta) => acc + venta.monto, 0);

    // Generar el PDF
    const pdfPath = await generarPDFCorte(ventas, tipo);

    console.log(`Corte generado correctamente: ${pdfPath}`);
    return { success: true, pdfPath, totalMonto };
  } catch (error) {
    console.error('Error al generar el corte:', error.message);
    return { success: false, error: error.message };
  }
});

// Función para imprimir el PDF
const imprimirPDF = async (pdfPath, printerName) => {
  try {
    await pdfToPrinter.print(pdfPath, { printer: printerName }); // Descomentado para usar pdf-to-printer
    console.log('PDF enviado a la impresora:', pdfPath);
  } catch (error) {
    console.error('Error al imprimir el PDF:', error.message);
    throw new Error('Error al imprimir el PDF');
  }
};

// Llamar esta función después de generar el PDF
ipcMain.handle('imprimir-corte', async (event, pdfPath, printerName) => {
  await imprimirPDF(pdfPath, printerName); // Descomentado para imprimir el corte
});

ipcMain.handle('buscar-producto', async (event, codigo) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM inventario WHERE codigo = ?', [codigo], (err, row) => {
      if (err) {
        console.error('Error al buscar el producto:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
});

ipcMain.handle('generarCorte', async (event, tipoCorte, nombreNegocio) => {
  try {
    const db = getDatabaseConnection();
    let ventas = [];
    const fechaActual = new Date().toISOString().split('T')[0];

    // Obtener las ventas según el tipo de corte
    if (tipoCorte === 'diario') {
      ventas = await new Promise((resolve, reject) => {
        db.all(
          'SELECT ventas.fecha_hora, inventario.nombre, ventas.cantidad, ventas.monto FROM ventas INNER JOIN inventario ON ventas.codigo_producto = inventario.codigo WHERE DATE(ventas.fecha_hora) = ?',
          [fechaActual],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener las ventas del día:', err.message);
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } else if (tipoCorte === 'semanal') {
      const fechaInicioSemana = new Date();
      fechaInicioSemana.setDate(fechaInicioSemana.getDate() - 7);
      const fechaInicio = fechaInicioSemana.toISOString().split('T')[0];

      ventas = await new Promise((resolve, reject) => {
        db.all(
          'SELECT ventas.fecha_hora, inventario.nombre, ventas.cantidad, ventas.monto FROM ventas INNER JOIN inventario ON ventas.codigo_producto = inventario.codigo WHERE DATE(ventas.fecha_hora) BETWEEN ? AND ?',
          [fechaInicio, fechaActual],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener las ventas de la semana:', err.message);
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } else if (tipoCorte === 'mensual') {
      const fechaInicioMes = new Date();
      fechaInicioMes.setMonth(fechaInicioMes.getMonth() - 1);
      const fechaInicio = fechaInicioMes.toISOString().split('T')[0];

      ventas = await new Promise((resolve, reject) => {
        db.all(
          'SELECT ventas.fecha_hora, inventario.nombre, ventas.cantidad, ventas.monto FROM ventas INNER JOIN inventario ON ventas.codigo_producto = inventario.codigo WHERE DATE(ventas.fecha_hora) BETWEEN ? AND ?',
          [fechaInicio, fechaActual],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener las ventas del mes:', err.message);
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    }

    // Calcular el total de las ventas
    const totalVentas = ventas.reduce((acc, venta) => acc + venta.monto, 0);

    // Generar el contenido dinámico del PDF
    let contenidoHTML = `
      <h1 style="text-align: center;">Corte ${tipoCorte.charAt(0).toUpperCase() + tipoCorte.slice(1)}</h1>
      <h2 style="text-align: center;">${nombreNegocio}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 8px;">Fecha y Hora</th>
            <th style="border: 1px solid black; padding: 8px;">Producto</th>
            <th style="border: 1px solid black; padding: 8px;">Cantidad</th>
            <th style="border: 1px solid black; padding: 8px;">Monto</th>
          </tr>
        </thead>
        <tbody>
    `;

    ventas.forEach((venta) => {
      contenidoHTML += `
        <tr>
          <td style="border: 1px solid black; padding: 8px;">${venta.fecha_hora}</td>
          <td style="border: 1px solid black; padding: 8px;">${venta.nombre}</td>
          <td style="border: 1px solid black; padding: 8px;">${venta.cantidad}</td>
          <td style="border: 1px solid black; padding: 8px;">Q${venta.monto.toFixed(2)}</td>
        </tr>
      `;
    });

    contenidoHTML += `
        </tbody>
      </table>
      <h3 style="text-align: right; margin-top: 20px;">Total: Q${totalVentas.toFixed(2)}</h3>
    `;

    // Generar el PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(contenidoHTML);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar Corte',
      defaultPath: `${nombreNegocio}_${tipoCorte}_${fechaActual}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled) {
      console.log('El usuario canceló la operación.');
      return { success: false, message: 'Operación cancelada por el usuario.' };
    }

    if (!filePath) {
      console.error('No se seleccionó una ruta para guardar el archivo.');
      return { success: false, message: 'No se seleccionó una ruta para guardar el archivo.' };
    }

    await page.pdf({ path: filePath, format: 'A4' });
    await browser.close();

    console.log(`PDF generado correctamente en: ${filePath}`);
    return { success: true, pdfPath: filePath };
  } catch (error) {
    console.error('Error al generar el corte:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getVentasPorPeriodo', async (event, periodo) => {
  try {
    const db = getDatabaseConnection(); // Obtener la conexión a la base de datos
    const fechaActual = new Date().toISOString().split('T')[0]; // Fecha en formato YYYY-MM-DD

    let ventas;
    if (periodo === 'diario') {
      ventas = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM ventas WHERE DATE(fecha_hora) = ?',
          [fechaActual],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener las ventas del día:', err.message);
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } else if (periodo === 'semanal') {
      const fechaInicioSemana = new Date();
      fechaInicioSemana.setDate(fechaInicioSemana.getDate() - 7);
      const fechaInicio = fechaInicioSemana.toISOString().split('T')[0];

      ventas = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM ventas WHERE DATE(fecha_hora) BETWEEN ? AND ?',
          [fechaInicio, fechaActual],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener las ventas de la semana:', err.message);
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } else if (periodo === 'mensual') {
      const fechaInicioMes = new Date();
      fechaInicioMes.setMonth(fechaInicioMes.getMonth() - 1);
      const fechaInicio = fechaInicioMes.toISOString().split('T')[0];

      ventas = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM ventas WHERE DATE(fecha_hora) BETWEEN ? AND ?',
          [fechaInicio, fechaActual],
          (err, rows) => {
            if (err) {
              console.error('Error al obtener las ventas del mes:', err.message);
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } else {
      throw new Error('Período no válido');
    }

    console.log(`Ventas obtenidas para el período ${periodo}:`, ventas);
    return ventas;
  } catch (error) {
    console.error('Error en getVentasPorPeriodo:', error.message);
    throw error;
  }
});

const getDatabaseConnection = () => {
  if (!db) {
    console.error('La conexión a la base de datos no está inicializada.');
    throw new Error('La conexión a la base de datos no está inicializada.');
  }
  return db;
};

ipcMain.handle('abrirPDF', async (event, pdfPath) => {
  try {
    if (!pdfPath) {
      throw new Error('La ruta del archivo PDF no es válida.');
    }

    // Abrir el archivo PDF con el visor predeterminado del sistema
    await shell.openPath(pdfPath);
    console.log(`Archivo PDF abierto: ${pdfPath}`);
    return { success: true };
  } catch (error) {
    console.error('Error al abrir el archivo PDF:', error.message);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  const cachePath = path.join(app.getPath('userData'), 'gpu-cache');
  app.commandLine.appendSwitch('disk-cache-dir', cachePath); // Especificar la ubicación de la caché
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});