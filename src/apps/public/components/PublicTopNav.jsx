import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/videos", label: "Videos" },
  { to: "/upload-team", label: "Upload Team" },
  { to: "/matches", label: "Matches" },
  { to: "/history", label: "History" },
  { to: "/bracket", label: "Bracket" },
  { to: "/live", label: "Watch Live" },
];

function PublicTopNav() {
  return (
    <header className="admin-topnav">
      <div className="admin-topnav-inner">
        <NavLink to="/" className="admin-brand">
          <img src="/jeiziproductions.png" alt="Jeizi Productions" className="brand-logo-img" />
          <span>Jeizi Productions</span>
        </NavLink>

        <nav className="admin-nav-links" aria-label="Public navigation">
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
      </div>
    </header>
  );
}

export default PublicTopNav;
