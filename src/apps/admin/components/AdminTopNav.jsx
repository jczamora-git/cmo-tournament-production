import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/teams", label: "Teams" },
  { to: "/team-submissions", label: "Submissions" },
  { to: "/matches", label: "Matches" },
  { to: "/history", label: "History" },
  { to: "/bracket", label: "Bracket" },
  { to: "/videos", label: "Videos" },
  { to: "/live-settings", label: "Live" },
];

function AdminTopNav({ onLogout }) {
  return (
    <header className="admin-topnav">
      <div className="admin-topnav-inner">
        <NavLink to="/dashboard" className="admin-brand">
          <img src="/jeiziproductions.png" alt="Jeizi Productions" className="brand-logo-img" />
          <span>Jeizi Admin</span>
        </NavLink>

        <nav className="admin-nav-links" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="admin-nav-logout"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export default AdminTopNav;
