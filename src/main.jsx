import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import PublicApp from "./apps/public/PublicApp";
import AdminApp from "./apps/admin/AdminApp";
import "./styles/index.css";

// Hostname-based routing: admin subdomain gets AdminApp, everything else gets PublicApp
const hostname = window.location.hostname;
const isAdmin = 
  hostname.startsWith("admin.") || hostname === "admin.jeiziproductions.dev";

function Root() {
  return isAdmin ? <AdminApp /> : <PublicApp />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
