import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Ventas from "./components/Ventas";
import Consulta from "./components/Consulta";
import Inventario from "./components/Inventario";
import Cortes from "./components/Cortes"; // Importar el componente Cortes
import { InventarioProvider } from "./components/InventarioContext"; // Importar el proveedor
import "./App.css";

function App() {
  const [view, setView] = useState("ventas");

  const renderView = () => {
    switch (view) {
      case "ventas":
        return <Ventas />;
      case "consulta":
        return <Consulta />;
      case "inventario":
        return <Inventario />;
      case "cortes":
        return <Cortes />;
      default:
        return <Ventas />; // Vista predeterminada
    }
  };

  return (
    <InventarioProvider>
      <div className="app-container">
        <Sidebar setView={setView} />
        <main className="content">
          {renderView()}
        </main>
      </div>
    </InventarioProvider>
  );
}

export default App;