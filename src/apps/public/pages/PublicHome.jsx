import { Link } from "react-router-dom";

const overviewCards = [
  {
    title: "Upload Team",
    description: "Submit your team for the tournament.",
    to: "/upload-team",
    icon: "📋",
  },
  {
    title: "View Matches",
    description: "See current and upcoming matches.",
    to: "/matches",
    icon: "⚔️",
  },
  {
    title: "View History",
    description: "Browse past match results.",
    to: "/history",
    icon: "📜",
  },
  {
    title: "View Bracket",
    description: "Check the tournament bracket.",
    to: "/bracket",
    icon: "🏆",
  },
  {
    title: "Watch Live",
    description: "Watch the official tournament broadcast",
    to: "/live",
    icon: "LIVE",
  },
];

function PublicHome() {
  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard-hero">
        <p className="admin-dashboard-eyebrow">JEIZI PRODUCTIONS TOURNAMENT</p>
        <h1>SK Barangay MLBB Season 2</h1>
        <p>Welcome to the official public portal for the tournament.</p>
        <div className="admin-dashboard-chips">
          <span>Public Portal</span>
          <span>Team Registration</span>
          <span>Live Tournament Hub</span>
        </div>
      </section>

      <section>
        <div className="admin-card-title-row">
          <div>
            <p className="admin-section-kicker">Navigation</p>
            <h2>Quick Access</h2>
          </div>
        </div>
        <div className="admin-overview-grid">
          {overviewCards.map((card) => (
            <Link key={card.to} className="admin-overview-card" to={card.to}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>{card.icon}</div>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
              <span className="admin-card-arrow">Open →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default PublicHome;
