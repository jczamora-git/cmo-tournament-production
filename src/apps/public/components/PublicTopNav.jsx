import {
  useEffect,
  useState,
} from "react";

import {
  NavLink,
  useLocation,
} from "react-router-dom";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        className="
          admin-topnav
          public-topnav
        "
      >
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

          <button
            type="button"
            className="public-mobile-menu-toggle"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-nav-sheet"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        id="public-mobile-nav-sheet"
        className={[
          "public-mobile-nav-sheet",
          mobileMenuOpen ? "is-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="public-mobile-sheet-header">
          <NavLink
            to="/"
            className="public-mobile-sheet-brand"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img src="/jeiziproductions.png" alt="" />
            <span>Jeizi Productions</span>
          </NavLink>

          <button
            type="button"
            className="public-mobile-menu-close"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span />
            <span />
          </button>
        </div>

        <nav
          className="public-mobile-sheet-links"
          aria-label="Mobile public navigation"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                [
                  "public-mobile-sheet-link",
                  isActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>


      </div>
    </>
  );
}

export default PublicTopNav;
