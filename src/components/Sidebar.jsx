import { FaShoppingCart, FaSearch, FaBoxes } from "react-icons/fa";

function Sidebar({ setView }) {
  return (
    <nav className="sidebar">
      <h2>Farmacia R&R</h2>
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
      </ul>
    </nav>
  );
}

export default Sidebar;
