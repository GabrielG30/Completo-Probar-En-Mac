import { useState, useEffect, useRef } from "react";
import { useInventario } from "./InventarioContext";
import "./Ventas.css";
import { FaCog } from "react-icons/fa";

function Ventas() {
  const { inventario, setInventario } = useInventario();
  const [productos, setProductos] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [pago, setPago] = useState("");
  const [factura, setFactura] = useState(null);
  const [ventaIniciada, setVentaIniciada] = useState(false);
  const [error, setError] = useState("");
  const [impresoras, setImpresoras] = useState([]);
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState(localStorage.getItem('impresoraPredeterminada') || '');
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [vuelto, setVuelto] = useState("0.00");

  const codigoInputRef = useRef(null);

  useEffect(() => {
    if (ventaIniciada && codigoInputRef.current) {
      codigoInputRef.current.focus();
    }
  }, [ventaIniciada]);

  useEffect(() => {
    const obtenerImpresoras = async () => {
      try {
        const printers = await window.electron.getPrinters();
        setImpresoras(printers);

        const impresoraGuardada = localStorage.getItem('impresoraPredeterminada');
        if (impresoraGuardada) {
          setImpresoraSeleccionada(impresoraGuardada);
        }
      } catch (error) {
        console.error('Error al obtener las impresoras:', error);
      }
    };

    obtenerImpresoras();
  }, []);

  useEffect(() => {
    if (impresoraSeleccionada) {
      localStorage.setItem('impresoraPredeterminada', impresoraSeleccionada);
    }
  }, [impresoraSeleccionada]);

  const handleImpresoraChange = (e) => {
    setImpresoraSeleccionada(e.target.value);
    setMostrarConfiguracion(false);
  };

  const togglePrinterConfig = () => {
    setMostrarConfiguracion(prev => !prev);
  };

  const actualizarInventario = async () => {
    try {
      const inventarioActualizado = await window.electron.readInventario();
      setInventario(inventarioActualizado);
      console.log('Inventario actualizado correctamente.');
    } catch (error) {
      console.error('Error al actualizar el inventario:', error.message);
      setError("Error al actualizar el inventario. Intenta nuevamente.");
    }
  };

  const iniciarVenta = async () => {
    try {
      await actualizarInventario();
      setVentaIniciada(true);
      setError("");
    } catch (error) {
      console.error('Error al iniciar la venta:', error);
      setError("Error al iniciar la venta. Intenta nuevamente.");
    }
  };

  const agregarProducto = () => {
    if (!codigo.trim()) {
      setError("Por favor, ingresa un código válido.");
      return;
    }

    const productoEncontrado = inventario.find(item => String(item.codigo).trim() === codigo.trim());
    if (productoEncontrado) {
      if (productoEncontrado.stock <= 0) {
        setError("Stock insuficiente para este producto.");
        return;
      }

      setProductos(prev => {
        const existe = prev.find(prod => prod.codigo === productoEncontrado.codigo);
        if (existe) {
          if (existe.cantidad >= productoEncontrado.stock) {
            setError("No hay suficiente stock para agregar más.");
            return prev;
          }
          return prev.map(prod =>
            prod.codigo === productoEncontrado.codigo
              ? { ...prod, cantidad: prod.cantidad + 1 }
              : prod
          );
        }
        return [...prev, { ...productoEncontrado, cantidad: 1 }];
      });
      setError("");
    } else {
      setError("Producto no encontrado.");
    }
    setCodigo("");
  };

  const handleCodigoKeyPress = (e) => {
    if (e.key === "Enter") {
      agregarProducto();
    }
  };

  const modificarCantidad = (codigo, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      setError("La cantidad no puede ser menor que 1.");
      return;
    }

    const producto = inventario.find(item => item.codigo === codigo);
    if (producto && nuevaCantidad > producto.stock) {
      setError("No hay suficiente stock para esta cantidad.");
      return;
    }

    setProductos(prev =>
      prev.map(prod =>
        prod.codigo === codigo ? { ...prod, cantidad: nuevaCantidad } : prod
      )
    );
    setError("");
  };

  const calcularTotal = () => {
    let total = productos.reduce((sum, prod) => sum + prod.precio * prod.cantidad, 0);
    return metodoPago === "tarjeta" ? (total * 1.05).toFixed(2) : total.toFixed(2); // Cambiado de 1.06 a 1.05
  };

  const calcularVuelto = () => {
    const total = parseFloat(calcularTotal());
    const pagoEfectivo = parseFloat(pago);
    return pagoEfectivo >= total ? (pagoEfectivo - total).toFixed(2) : "0.00";
  };

  const finalizarVenta = async () => {
    if (productos.length === 0) {
      setError("No hay productos en la venta.");
      return;
    }

    if (metodoPago === "efectivo" && (!pago || parseFloat(pago) < parseFloat(calcularTotal()))) {
      setError("La cantidad pagada es insuficiente.");
      return;
    }

    const total = calcularTotal();
    const vueltoCalculado = calcularVuelto();
    setVuelto(vueltoCalculado);

    try {
      console.log("Iniciando proceso de venta...");

      for (const prod of productos) {
        console.log(`Actualizando stock para producto ${prod.codigo}...`);
        const resultado = await window.electron.updateStock(prod.codigo, prod.cantidad);
        console.log('Resultado de actualización:', resultado);
        if (resultado === 'No se encontró el producto o stock insuficiente') {
          throw new Error(`Producto no encontrado o stock insuficiente: ${prod.codigo}`);
        }
      }

      const nuevaFactura = {
        productos,
        total,
        metodoPago,
        pago,
        vuelto: vueltoCalculado,
        fecha: new Date().toLocaleString(),
      };
      setFactura(nuevaFactura);

      imprimirFactura(nuevaFactura);

      setVentaIniciada(false);
      setProductos([]);
      setCodigo("");
      setPago("");
      setMetodoPago("efectivo");
      setError("");
    } catch (error) {
      console.error("Error al realizar la venta:", error);
      setError(error.message || "Error al realizar la venta. Intenta nuevamente.");
    }
  };

  const imprimirFactura = (factura) => {
    const facturaHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3 style="text-align: center;">Farmacia R&R</h3>
        <p style="text-align: center;">Fecha: ${factura.fecha}</p>
        <hr />
        ${factura.productos.map(prod => `
          <p>${prod.nombre} x ${prod.cantidad} - Q${(prod.precio * prod.cantidad).toFixed(2)}</p>
        `).join('')}
        <hr />
        <p>Total: Q${factura.total}</p>
        <p>Pago: Q${factura.pago}</p>
        ${factura.metodoPago === "efectivo" ? `<p>Vuelto: Q${factura.vuelto}</p>` : ''}
        <p>Método de pago: ${factura.metodoPago === "tarjeta" ? "Tarjeta (+5%)" : "Efectivo"}</p>
        <hr />
        <p style="text-align: center;">¡Gracias por su compra!</p>
      </div>
    `;

    window.electron.printInvoice(facturaHTML, impresoraSeleccionada);
  };

  const cerrarFactura = () => {
    setFactura(null);
    setProductos([]);
    setCodigo("");
    setPago("");
    setMetodoPago("efectivo");
    setVentaIniciada(false);
    setError("");
  };

  return (
    <div className="ventas-container dark-mode">
      <h2>Caja</h2>

      <div className="configuracion-impresora">
        <FaCog
          className="configuracion-icono"
          onClick={togglePrinterConfig}
          style={{ cursor: 'pointer' }}
        />
        {mostrarConfiguracion && (
          <div className="configuracion-menu">
            <label>Seleccionar impresora:</label>
            <select
              value={impresoraSeleccionada}
              onChange={handleImpresoraChange}
            >
              <option value="">Seleccione una impresora</option>
              {impresoras.map((printer, index) => (
                <option key={index} value={printer.name}>
                  {printer.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!ventaIniciada ? (
        <button className="iniciar-venta" onClick={iniciarVenta}>Iniciar Venta</button>
      ) : (
        <>
          <div className="input-group">
            <input
              type="text"
              placeholder="Escanear código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyPress={handleCodigoKeyPress}
              ref={codigoInputRef}
              autoFocus
            />
            <button className="agregar-btn" onClick={agregarProducto}>Agregar</button>
          </div>
          {error && <p className="error-message">{error}</p>}
          <table className="productos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((prod, index) => (
                <tr key={index}>
                  <td>{prod.nombre}</td>
                  <td>
                    <input
                      type="number"
                      value={prod.cantidad}
                      onChange={(e) => modificarCantidad(prod.codigo, parseInt(e.target.value))}
                      min="1"
                    />
                  </td>
                  <td>Q{prod.precio.toFixed(2)}</td>
                  <td>Q{(prod.precio * prod.cantidad).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="resumen">
            <h3>Total: Q{calcularTotal()}</h3>
            <select onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta (+5%)</option>
            </select>
            {metodoPago === "efectivo" && (
              <input
                type="number"
                placeholder="Cantidad pagada"
                value={pago}
                onChange={(e) => setPago(e.target.value)}
              />
            )}
            {metodoPago === "efectivo" && <h3>Vuelto: Q{calcularVuelto()}</h3>}
            <button className="finalizar-venta" onClick={finalizarVenta}>Finalizar Venta</button>
          </div>
        </>
      )}

      {factura && (
        <div className="factura-popup">
          <div className="factura-modal">
            <h3>Farmacia R&R</h3>
            <p>Fecha: {factura.fecha}</p>
            <hr />
            {factura.productos.map((prod, index) => (
              <p key={index}>
                {prod.nombre} x {prod.cantidad} - Q{(prod.precio * prod.cantidad).toFixed(2)}
              </p>
            ))}
            <hr />
            <div className="factura-total">
              <p>Total: Q{factura.total}</p>
              <p>Pago: Q{factura.pago}</p>
              <p>Vuelto: Q{factura.vuelto}</p>
              <p>Método de pago: {factura.metodoPago === "tarjeta" ? "Tarjeta (+5%)" : "Efectivo"}</p>
            </div>
            <hr />
            <p>¡Gracias por su compra!</p>
            <button className="cerrar-factura" onClick={cerrarFactura}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Ventas;