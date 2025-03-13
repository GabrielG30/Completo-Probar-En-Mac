import React, { useEffect, useState, useRef } from "react";
import { FaCog, FaPlus } from "react-icons/fa";
import * as XLSX from "xlsx";
import "./Inventario.css";

const Inventario = () => {
  const [inventario, setInventario] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({ nombre: "", codigo: "", precio: "", stock: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [productToEdit, setProductToEdit] = useState(null);
  const [newProduct, setNewProduct] = useState({ nombre: "", codigo: "", precio: "", stock: "" });

  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    cargarInventarioDesdeDB();
  }, []);

  const cargarInventarioDesdeDB = async () => {
    try {
      const data = await window.electron.readInventario();
      setInventario(data);
    } catch (error) {
      console.error("Error al cargar el inventario:", error);
    }
  };

  const openAddProductModal = () => {
    setIsAddProductModalOpen(true);
  };

  const closeAddProductModal = () => {
    setIsAddProductModalOpen(false);
    setNewProduct({ nombre: "", codigo: "", precio: "", stock: "" });
  };

  const handleNewProductChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };

  const saveNewProduct = async () => {
    const { nombre, codigo, precio, stock } = newProduct;

    if (!nombre || !codigo || !precio || !stock) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    const newProductData = [{
      nombre,
      codigo,
      precio: parseFloat(precio).toFixed(2),
      stock: parseInt(stock)
    }];

    try {
      await window.electron.insertInventario(newProductData);
      closeAddProductModal();
      cargarInventarioDesdeDB();
    } catch (error) {
      console.error("Error al guardar el nuevo producto:", error);
      alert("Hubo un error al guardar el producto. Intenta nuevamente.");
    }
  };

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const binaryStr = e.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (data.length > 0) {
        setHeaders(data[0]);
        setInventario(data.slice(1));
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleColumnChange = (field, selectedColumn) => {
    setColumnMapping({ ...columnMapping, [field]: selectedColumn });
  };

  const saveInventario = async () => {
    if (!columnMapping.nombre || !columnMapping.codigo || !columnMapping.precio || !columnMapping.stock) {
      alert("Debes asignar todas las columnas antes de guardar");
      return;
    }

    const normalizeHeader = (header) => header.trim().toLowerCase();

    const mappedInventario = inventario.map((row) => {
      const nombreIndex = headers.findIndex((header) =>
        normalizeHeader(header) === normalizeHeader(columnMapping.nombre)
      );
      const codigoIndex = headers.findIndex((header) =>
        normalizeHeader(header) === normalizeHeader(columnMapping.codigo)
      );
      const precioIndex = headers.findIndex((header) =>
        normalizeHeader(header) === normalizeHeader(columnMapping.precio)
      );
      const stockIndex = headers.findIndex((header) =>
        normalizeHeader(header) === normalizeHeader(columnMapping.stock)
      );

      const nombre = row[nombreIndex] || "";
      const codigo = row[codigoIndex] ? row[codigoIndex].toString().trim() : "";
      const precio = parseFloat(row[precioIndex]) || 0.0;
      const stock = parseInt(row[stockIndex]) || 0;

      if (nombre && codigo) {
        return {
          nombre: nombre,
          codigo: codigo,
          precio: precio.toFixed(2),
          stock: stock,
        };
      }
      return null;
    }).filter(product => product !== null);

    try {
      await window.electron.insertInventario(mappedInventario);
      setIsModalOpen(false);
      cargarInventarioDesdeDB();
    } catch (error) {
      console.error("Error al guardar el inventario:", error);
    }
  };

  const deleteInventario = async () => {
    setInventario([]);
    try {
      await window.electron.deleteInventario();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error al eliminar el inventario:", error);
    }
  };

  const handleDeleteConfirm = () => {
    const isFirstConfirmation = window.confirm("¿Estás seguro que deseas borrar todo el inventario?");
    if (isFirstConfirmation) {
      const isSecondConfirmation = window.confirm("¿Estás seguro de borrar el inventario de la base de datos?");
      if (isSecondConfirmation) {
        deleteInventario();
      }
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSearch = () => {
    const product = inventario.find(item => item.codigo === searchCode.trim());
    if (product) {
      setProductToEdit(product);
    } else {
      alert("Producto no encontrado");
      setSearchCode(""); // Limpiar el campo de búsqueda
      if (searchInputRef.current) {
        searchInputRef.current.focus(); // Enfocar nuevamente el campo de búsqueda
      }
    }
  };

  const closeEditModal = () => {
    setProductToEdit(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleEditProduct = async () => {
    if (productToEdit) {
      const updatedProduct = {
        ...productToEdit,
        precio: parseFloat(productToEdit.precio).toFixed(2),
        stock: parseInt(productToEdit.stock),
      };

      try {
        await window.electron.updateInventario(updatedProduct);
        cargarInventarioDesdeDB();
        closeEditModal();
      } catch (error) {
        console.error("Error al editar el producto:", error);
      }
    }
  };

  const deleteProduct = async (codigo) => {
    try {
      await window.electron.deleteProducto(codigo);
      cargarInventarioDesdeDB();
      closeEditModal();
      setSearchCode(""); // Limpiar el campo de búsqueda
      if (searchInputRef.current) {
        searchInputRef.current.focus(); // Enfocar nuevamente el campo de búsqueda
      }
    } catch (error) {
      console.error("Error al eliminar el producto:", error);
      alert("Hubo un error al eliminar el producto. Intenta nuevamente.");
    }
  };

  return (
    <div className="inventario-container">
      <div className="icon-container">
        <div className="config-icon" onClick={() => setIsModalOpen(true)}>
          <FaCog size={30} />
        </div>
        <div className="add-product-icon" onClick={openAddProductModal}>
          <FaPlus size={30} />
        </div>
      </div>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setIsModalOpen(false)}>&times;</span>
            <h3>Subir Inventario</h3>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="file-upload" />
            {headers.length > 0 && (
              <div className="column-mapping">
                {Object.keys(columnMapping).map((field) => (
                  <div key={field} className="column-select">
                    <label>{field.charAt(0).toUpperCase() + field.slice(1)}:</label>
                    <select value={columnMapping[field]} onChange={(e) => handleColumnChange(field, e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <button onClick={saveInventario}>Guardar Inventario</button>
            <button onClick={() => setIsDeleteModalOpen(true)}>Eliminar Inventario</button>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setIsDeleteModalOpen(false)}>&times;</span>
            <h3>¿Estás seguro de eliminar el inventario?</h3>
            <button onClick={handleDeleteConfirm}>Sí, eliminar</button>
            <button onClick={() => setIsDeleteModalOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {isAddProductModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeAddProductModal}>&times;</span>
            <h3>Agregar Producto</h3>
            <div>
              <label>Nombre:</label>
              <input
                type="text"
                name="nombre"
                value={newProduct.nombre}
                onChange={handleNewProductChange}
              />
            </div>
            <div>
              <label>Código:</label>
              <input
                type="text"
                name="codigo"
                value={newProduct.codigo}
                onChange={handleNewProductChange}
              />
            </div>
            <div>
              <label>Precio:</label>
              <input
                type="number"
                name="precio"
                value={newProduct.precio}
                onChange={handleNewProductChange}
              />
            </div>
            <div>
              <label>Stock:</label>
              <input
                type="number"
                name="stock"
                value={newProduct.stock}
                onChange={handleNewProductChange}
              />
            </div>
            <button onClick={saveNewProduct}>Guardar Producto</button>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Ingresa código de barras"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          ref={searchInputRef}
          autoFocus
        />
        <button onClick={handleSearch}>Buscar</button>
      </div>

      {productToEdit && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeEditModal}>&times;</span>
            <h3>Editar Producto</h3>
            <div>
              <label>Nombre:</label>
              <input
                type="text"
                value={productToEdit.nombre}
                onChange={(e) => setProductToEdit({ ...productToEdit, nombre: e.target.value })}
              />
            </div>
            <div>
              <label>Código:</label>
              <input
                type="text"
                value={productToEdit.codigo}
                onChange={(e) => setProductToEdit({ ...productToEdit, codigo: e.target.value })}
              />
            </div>
            <div>
              <label>Precio:</label>
              <input
                type="number"
                value={productToEdit.precio}
                onChange={(e) => setProductToEdit({ ...productToEdit, precio: e.target.value })}
              />
            </div>
            <div>
              <label>Stock:</label>
              <input
                type="number"
                value={productToEdit.stock}
                onChange={(e) => setProductToEdit({ ...productToEdit, stock: e.target.value })}
              />
            </div>
            <button onClick={handleEditProduct}>Guardar Cambios</button>
            <button onClick={() => deleteProduct(productToEdit.codigo)} style={{ marginLeft: '10px', backgroundColor: 'red', color: 'white' }}>Eliminar Producto</button>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Código</th>
            <th>Precio</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {inventario.map((producto, index) => (
            <tr key={index}>
              <td>{producto.nombre}</td>
              <td>{producto.codigo}</td>
              <td>{producto.precio}</td>
              <td>{producto.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Inventario;