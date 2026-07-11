import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import PublicApp from "./apps/public/PublicApp";
import AdminApp from "./apps/admin/AdminApp";
import "./styles/index.css";
import "./styles/admin-controller.css";
import "./styles/public-landing.css";
import "./styles/public-bracket.css";
import "./styles/public-matches.css";

// Hostname-based routing: admin subdomain gets AdminApp, everything else gets PublicApp
const hostname = window.location.hostname;
const ADMIN_HOSTS = [
  "adminjeizi.vercel.app",
  "admin.jeiziproductions.dev",
];
const isAdmin =
  ADMIN_HOSTS.includes(hostname) || hostname.startsWith("admin.");

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
