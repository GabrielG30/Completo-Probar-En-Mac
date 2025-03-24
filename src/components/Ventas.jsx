import { useState, useEffect, useRef } from "react";
import { useInventario } from "./InventarioContext";
import "./Ventas.css";
import { FaCog } from "react-icons/fa";

function Ventas() {
  const { inventario, setInventario } = useInventario();
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [pago, setPago] = useState("");
  const [factura, setFactura] = useState(null);
  const [ventaIniciada, setVentaIniciada] = useState(false);
  const [error, setError] = useState("");
  const [impresoras, setImpresoras] = useState([]);
  const [impresoraSeleccionada, setImpresoraSeleccionada] = useState(localStorage.getItem('impresoraPredeterminada') || '');
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [vuelto, setVuelto] = useState("0.00");
  const [productosEncontrados, setProductosEncontrados] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [nombreNegocio, setNombreNegocio] = useState(localStorage.getItem('nombreNegocio') || '');
  const [ventaEnProceso, setVentaEnProceso] = useState(false); // Nuevo estado para controlar el proceso de venta

  const busquedaInputRef = useRef(null);

  useEffect(() => {
    if (modalIsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [modalIsOpen]);

  useEffect(() => {
    if (!modalIsOpen && busquedaInputRef.current) {
      busquedaInputRef.current.focus();
    }
  }, [modalIsOpen]);

  useEffect(() => {
    if (ventaIniciada && busquedaInputRef.current) {
      busquedaInputRef.current.focus();
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

  const handleNombreNegocioChange = (e) => {
    setNombreNegocio(e.target.value);
  };

  const guardarNombreNegocio = () => {
    localStorage.setItem('nombreNegocio', nombreNegocio);
    setMostrarConfiguracion(false); // Cerrar el menú de configuración
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

  const agregarProducto = (producto) => {
    if (!producto) {
      setError("Por favor, selecciona un producto válido.");
      return;
    }

    if (producto.stock <= 0) {
      setError("Stock insuficiente para este producto.");
      return;
    }

    setProductos(prev => {
      const existe = prev.find(prod => prod.codigo === producto.codigo);
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          setError("No hay suficiente stock para agregar más.");
          return prev;
        }
        return prev.map(prod =>
          prod.codigo === producto.codigo
            ? { ...prod, cantidad: prod.cantidad + 1 }
            : prod
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
    setError("");
    setBusqueda("");
    setProductosEncontrados([]);
  };

  const buscarProducto = () => {
    if (busqueda.trim()) {
      const productosEncontrados = inventario.filter(item =>
        item.codigo.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
        item.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
      );

      if (productosEncontrados.length === 0) {
        setError("Producto no encontrado.");
        setBusqueda(""); // Limpia el campo de búsqueda
        setProductosEncontrados([]);
        return;
      }

      setProductosEncontrados(productosEncontrados);
      setModalIsOpen(true);
    }
  };

  const handleBusquedaKeyPress = (e) => {
    if (e.key === "Enter") {
      buscarProducto();
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

  const eliminarProducto = (codigo) => {
    setProductos(prev => prev.filter(prod => prod.codigo !== codigo));
  };

  const calcularTotal = () => {
    let total = productos.reduce((sum, prod) => sum + prod.precio * prod.cantidad, 0);
    return metodoPago === "tarjeta" ? (total * 1.05).toFixed(2) : total.toFixed(2);
  };

  const calcularVuelto = () => {
    const total = parseFloat(calcularTotal());
    const pagoEfectivo = parseFloat(pago);
    return pagoEfectivo >= total ? (pagoEfectivo - total).toFixed(2) : "0.00";
  };

  const finalizarVenta = async () => {
    if (ventaEnProceso) return; // Evitar múltiples clics si ya está en proceso

    try {
      setVentaEnProceso(true); // Indicar que la venta está en proceso

      // Actualizar el inventario antes de finalizar la venta
      await actualizarInventario();

      const total = calcularTotal();
      const vueltoCalculado = calcularVuelto();

      const venta = {
        productos: productos.map(prod => ({
          codigo: prod.codigo,
          nombre: prod.nombre,
          cantidad: prod.cantidad,
          precio: prod.precio,
        })),
        total: parseFloat(total),
        metodoPago,
        pago: parseFloat(pago),
        vuelto: parseFloat(vueltoCalculado),
        nombreNegocio, // Pasar el nombre del negocio configurado
      };

      // Enviar la venta al backend
      const resultado = await window.electron.realizarVenta(venta, impresoraSeleccionada);

      if (!resultado.success) {
        throw new Error("Error al registrar la venta en la base de datos.");
      }

      console.log("Venta registrada correctamente.");

      // Generar la factura para mostrar en pantalla
      const nuevaFactura = {
        ...venta,
        fecha: new Date().toLocaleString(),
      };
      setFactura(nuevaFactura);

      // Limpiar los datos de la venta
      setVentaIniciada(false);
      setProductos([]);
      setBusqueda("");
      setPago("");
      setMetodoPago("efectivo");
      setError("");
    } catch (error) {
      console.error("Error al finalizar la venta:", error.message);
      setError(error.message || "Error al finalizar la venta. Intenta nuevamente.");
    } finally {
      setVentaEnProceso(false); // Permitir nuevas ventas después de finalizar
    }
  };

  const imprimirFactura = (factura) => {
    const facturaHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        ${factura.nombreNegocio ? `<h3 style="text-align: center;">${factura.nombreNegocio}</h3>` : ''}
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
    setBusqueda("");
    setPago("");
    setMetodoPago("efectivo");
    setVentaIniciada(false);
    setError("");
  };

  const handleProductoSeleccionado = (producto) => {
    setProductosSeleccionados(prev => {
      if (prev.includes(producto)) {
        return prev.filter(p => p !== producto);
      } else {
        return [...prev, producto];
      }
    });
  };

  const confirmarSeleccion = () => {
    productosSeleccionados.forEach(producto => agregarProducto(producto));
    setProductosSeleccionados([]);
    setModalIsOpen(false);
  };

  const cerrarModal = () => {
    setModalIsOpen(false);
    setBusqueda("");
    setProductosEncontrados([]);
    setProductosSeleccionados([]);
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
            <label>Nombre del negocio:</label>
            <input
              type="text"
              value={nombreNegocio}
              onChange={handleNombreNegocioChange}
              placeholder="Ingrese el nombre del negocio"
            />
            <button onClick={guardarNombreNegocio}>Guardar</button>
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
              placeholder="Buscar por código o nombre"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyPress={handleBusquedaKeyPress}
              ref={busquedaInputRef}
              autoFocus
            />
            <button className="agregar-btn" onClick={buscarProducto}>Buscar</button>
          </div>
          {error && <p className="error-message">{error}</p>}
          {productosEncontrados.length > 0 && (
            <div
              className={`modal ${modalIsOpen ? 'is-open' : ''}`}
              onClick={cerrarModal}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="close" onClick={cerrarModal}>&times;</span>
                <h3>Selecciona productos:</h3>
                <ul>
                  {productosEncontrados.map((prod, index) => (
                    <li key={index}>
                      <input
                        type="checkbox"
                        checked={productosSeleccionados.includes(prod)}
                        onChange={() => handleProductoSeleccionado(prod)}
                      />
                      {prod.nombre} - {prod.codigo} - Q{prod.precio.toFixed(2)} - Estante: {prod.estante}
                    </li>
                  ))}
                </ul>
                <button className="confirmar-seleccion" onClick={confirmarSeleccion}>Aceptar</button>
              </div>
            </div>
          )}
          <table className="productos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
                <th>Acciones</th>
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
                  <td>
                    <button className="eliminar-btn" onClick={() => eliminarProducto(prod.codigo)}>X</button>
                  </td>
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
            {factura.nombreNegocio && <h3>{factura.nombreNegocio}</h3>}
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