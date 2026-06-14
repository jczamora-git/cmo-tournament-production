import { Routes, Route, NavLink } from "react-router-dom";
import PublicHome from "./pages/PublicHome";
import UploadTeam from "./pages/UploadTeam";
import ViewMatches from "./pages/ViewMatches";
import ViewHistory from "./pages/ViewHistory";
import ViewBracket from "./pages/ViewBracket";

function PublicApp() {
  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/upload-team">Upload Team</NavLink>
        <NavLink to="/matches">Matches</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/bracket">Bracket</NavLink>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/upload-team" element={<UploadTeam />} />
          <Route path="/matches" element={<ViewMatches />} />
          <Route path="/history" element={<ViewHistory />} />
          <Route path="/bracket" element={<ViewBracket />} />
        </Routes>
      </main>
    </div>
  );
}

export default PublicApp;
