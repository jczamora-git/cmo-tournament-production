import { Link } from "react-router-dom";

function PublicHome() {
  return (
    <div className="public-home">
      <div className="hero">
        <h1>Jeizi Productions Tournament</h1>
        <p className="hero-sub">SK Barangay MLBB Season 2</p>
      </div>
      <div className="home-cards">
        <Link to="/upload-team" className="home-card">
          <div className="home-card-icon">+</div>
          <h3>Upload Team</h3>
          <p>Submit your team for the tournament</p>
        </Link>
        <Link to="/matches" className="home-card">
          <div className="home-card-icon">VS</div>
          <h3>View Matches</h3>
          <p>See current and upcoming matches</p>
        </Link>
        <Link to="/history" className="home-card">
          <div className="home-card-icon">H</div>
          <h3>View History</h3>
          <p>Browse past match results</p>
        </Link>
        <Link to="/bracket" className="home-card">
          <div className="home-card-icon">B</div>
          <h3>View Bracket</h3>
          <p>Check the tournament bracket</p>
        </Link>
      </div>
    </div>
  );
}

export default PublicHome;
