import { Routes, Route, NavLink } from "react-router-dom";
import TeamUpload from "./pages/TeamUpload";
import Matches from "./pages/Matches";
import Upcoming from "./pages/Upcoming";
import History from "./pages/History";
import Bracket from "./pages/Bracket";

function App() {
  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/">Teams</NavLink>
        <NavLink to="/matches">Matches</NavLink>
        <NavLink to="/upcoming">Upcoming</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/bracket">Bracket</NavLink>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<TeamUpload />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/history" element={<History />} />
          <Route path="/bracket" element={<Bracket />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
