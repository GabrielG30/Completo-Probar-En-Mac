import { useState, useEffect, useRef } from "react"; // Añadimos useRef
import { useInventario } from "./InventarioContext";
import "./Ventas.css";
import { FaCog } from "react-icons/fa"; // Importar ícono de tuerca

function Ventas() {
  const { inventario, setInventario } = useInventario();
  const [productos, setProductos] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [pago, setPago] = useState("");
  const [factura, setFactura] = useState(null);
  const [ventaIniciada, setVentaIniciada] = useState(false);
  const [error, setError] = useState("");
  const [impresoras, setImpresoras] = useState([]); // Lista de impresoras
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState(""); // Impresora seleccionada
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false); // Mostrar/ocultar menú de configuración

  // Referencia para el campo de entrada del código de barras
  const codigoInputRef = useRef(null);

  // Enfocar automáticamente el campo de entrada cuando se inicia una venta
  useEffect(() => {
    if (ventaIniciada && codigoInputRef.current) {
      codigoInputRef.current.focus();
    }
  }, [ventaIniciada]);

  // Obtener la lista de impresoras al cargar el componente
  useEffect(() => {
    const obtenerImpresoras = async () => {
      try {
        const printers = await window.electron.getPrinters();
        setImpresoras(printers);

        // Cargar la impresora predeterminada guardada (si existe)
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

  // Guardar la impresora seleccionada
  const handleImpresoraChange = (e) => {
    const selectedPrinter = e.target.value;
    setImpresoraSeleccionada(selectedPrinter);
    localStorage.setItem('impresoraPredeterminada', selectedPrinter); // Guardar en localStorage
  };

  // Función para actualizar el inventario desde la base de datos
  const actualizarInventario = async () => {
    try {
      const inventarioActualizado = await window.electron.readInventario();
      setInventario(inventarioActualizado); // Actualiza el estado del inventario
      console.log('Inventario actualizado correctamente.');
    } catch (error) {
      console.error('Error al actualizar el inventario:', error.message);
      setError("Error al actualizar el inventario. Intenta nuevamente.");
    }
  };

  const iniciarVenta = async () => {
    try {
      // Actualizar el inventario antes de iniciar la venta
      await actualizarInventario();
      setVentaIniciada(true); // Iniciar la venta
      setError(""); // Limpiar mensajes de error
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

  // Detectar cuando se presiona "Enter" en el campo de código de barras
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
    return metodoPago === "tarjeta" ? (total * 1.06).toFixed(2) : total.toFixed(2);
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
    const vuelto = calcularVuelto();

    try {
      console.log("Iniciando proceso de venta...");

      // Actualizar el stock en la base de datos
      for (const prod of productos) {
        console.log(`Actualizando stock para producto ${prod.codigo}...`);
        const resultado = await window.electron.updateStock(prod.codigo, prod.cantidad);
        console.log('Resultado de actualización:', resultado); // Depuración: Verifica el resultado
        if (resultado === 'No se encontró el producto o stock insuficiente') {
          throw new Error(`Producto no encontrado o stock insuficiente: ${prod.codigo}`);
        }
      }

      // Si todo sale bien, mostrar la factura
      const nuevaFactura = {
        productos,
        total,
        metodoPago,
        pago,
        vuelto,
        fecha: new Date().toLocaleString()
      };
      setFactura(nuevaFactura);

      // Actualizar el inventario en el estado
      setInventario(prev => prev.map(item => {
        const productoVendido = productos.find(prod => prod.codigo === item.codigo);
        if (productoVendido) {
          return { ...item, stock: item.stock - productoVendido.cantidad };
        }
        return item;
      }));

      alert("Venta realizada con éxito");
    } catch (error) {
      console.error("Error al realizar la venta:", error);
      setError(error.message || "Error al realizar la venta. Intenta nuevamente.");
    }
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

      {/* Ícono de configuración */}
      <div className="configuracion-impresora">
        <FaCog
          className="configuracion-icono"
          onClick={() => setMostrarConfiguracion(!mostrarConfiguracion)}
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
              onKeyPress={handleCodigoKeyPress} // Detectar "Enter"
              ref={codigoInputRef} // Referencia para enfocar automáticamente
              autoFocus // Enfocar automáticamente
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
              <option value="tarjeta">Tarjeta (+6%)</option>
            </select>
            {metodoPago === "efectivo" && (
              <input
                type="number"
                placeholder="Cantidad pagada"
                value={pago}
                onChange={(e) => setPago(e.target.value)}
              />
            )}
            <h3>Vuelto: Q{calcularVuelto()}</h3>
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
              <p>Método de pago: {factura.metodoPago === "tarjeta" ? "Tarjeta (+6%)" : "Efectivo"}</p>
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