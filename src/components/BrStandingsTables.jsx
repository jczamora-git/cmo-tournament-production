import { useState } from "react";

function TeamCell({ team }) {
  const [imgError, setImgError] = useState(false);
  const name = team.team_name || team.team_shortname || `Team ${team.team_id}`;
  const tag = team.team_shortname && team.team_name ? team.team_shortname : null;
  const initial = (tag || name || "?").charAt(0).toUpperCase();

  return (
    <div className="standings-team-cell">
      {team.team_logo && !imgError ? (
        <img
          src={team.team_logo}
          alt=""
          className="standings-team-logo"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="standings-team-logo-fallback" aria-hidden>
          {initial}
        </div>
      )}
      <div>
        <span className="standings-team-name">
          {name}
          {team.is_eliminated ? (
            <span className="standings-eliminated-badge">Out</span>
          ) : null}
        </span>
        {tag ? <span className="standings-team-tag">{tag}</span> : null}
      </div>
    </div>
  );
}

/**
 * Shared BR standings group tables.
 * @param {{ groups: Array, detailed?: boolean }} props
 */
function BrStandingsTables({ groups = [], detailed = false }) {
  if (!groups.length) return null;

  return (
    <div className="standings-groups-grid">
      {groups.map((group) => (
        <section key={group.group_name} className="standings-group-card">
          <div className="standings-group-header">
            <h2>{group.group_name}</h2>
            <span className="standings-group-count">
              {group.standings?.length || 0} team{(group.standings?.length || 0) === 1 ? "" : "s"}
            </span>
          </div>

          <div className="admin-table-container">
            <table className="admin-teams-table">
              <thead>
                <tr>
                  <th className="th-number">Rank</th>
                  <th>Team</th>
                  <th className="th-number">Kills</th>
                  <th className="th-number">Placement</th>
                  {detailed ? <th className="th-number">Kill Pts</th> : null}
                  <th className="th-number">Total</th>
                  {detailed ? <th className="th-number">Rounds</th> : null}
                </tr>
              </thead>
              <tbody>
                {(group.standings || []).map((row, index) => {
                  const rank = row.final_rank || index + 1;
                  return (
                    <tr
                      key={row.id || `${group.group_name}-${row.team_id}`}
                      className={row.is_eliminated ? "standings-eliminated" : undefined}
                    >
                      <td className={`standings-rank td-number${rank <= 3 ? " is-top" : ""}`}>
                        {rank}
                      </td>
                      <td>
                        <TeamCell team={row} />
                      </td>
                      <td className="standings-num td-number">{row.kills ?? 0}</td>
                      <td className="standings-num td-number">{row.placement_points ?? 0}</td>
                      {detailed ? (
                        <td className="standings-num td-number">{row.kill_points ?? 0}</td>
                      ) : null}
                      <td className="standings-points td-number">{row.total_points ?? 0}</td>
                      {detailed ? (
                        <td className="standings-num td-number">{row.rounds_played ?? 0}</td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export default BrStandingsTables;
