import { FaShoppingCart, FaSearch, FaBoxes, FaFilePdf } from "react-icons/fa";

function Sidebar({ setView }) {
  return (
    <nav className="sidebar">
      <h2>PosGo</h2>
      <ul>
        <li onClick={() => setView("ventas")}>
          <FaShoppingCart /> Caja
        </li>
        <li onClick={() => setView("consulta")}>
          <FaSearch /> Consulta
        </li>
        <li onClick={() => setView("inventario")}>
          <FaBoxes /> Inventario
        </li>
        <li onClick={() => setView("cortes")}>
          <FaFilePdf /> Cortes
        </li>
      </ul>
    </nav>
  );
}

export default Sidebar;
