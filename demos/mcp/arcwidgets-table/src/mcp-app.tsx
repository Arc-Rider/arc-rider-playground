import { createRoot } from "react-dom/client";
import { TableApp } from "./App";
import "./mcp-app.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element missing");
}

createRoot(root).render(<TableApp />);
