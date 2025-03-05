// src/App.jsx
import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Ventas from "./components/Venta";
import Consulta from "./components/Consulta";
import Inventario from "./components/Inventario";
import { InventarioProvider } from "./components/InventarioContext"; // Importar el proveedor
import "./App.css";

function App() {
  const [view, setView] = useState("ventas");

  return (
    <InventarioProvider>
      <div className="app-container">
        <Sidebar setView={setView} />
        <main className="content">
          {view === "ventas" && <Ventas />}
          {view === "consulta" && <Consulta />}
          {view === "inventario" && <Inventario />}
        </main>
      </div>
    </InventarioProvider>
  );
}

export default App;
