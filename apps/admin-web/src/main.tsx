import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminApp } from "./AdminApp";
import { AdminErrorBoundary } from "./AdminErrorBoundary";
import "./admin.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <AdminErrorBoundary>
      <AdminApp />
    </AdminErrorBoundary>
  </StrictMode>,
);
