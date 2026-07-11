import { useState } from "react";

function RankBadge({ rank }) {
  const tier =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";

  return (
    <span className={`brs-rank-badge brs-rank-badge--${tier}`} aria-label={`Rank ${rank}`}>
      <span className="brs-rank-hash">#</span>
      {rank}
    </span>
  );
}

function TeamCell({ team }) {
  const [imgError, setImgError] = useState(false);
  const name = team.team_name || team.team_shortname || `Team ${team.team_id}`;
  const tag = team.team_shortname && team.team_name ? team.team_shortname : null;
  const initial = (tag || name || "?").charAt(0).toUpperCase();

  return (
    <div className="brs-team">
      {team.team_logo && !imgError ? (
        <img
          src={team.team_logo}
          alt=""
          className="brs-team-logo"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="brs-team-fallback" aria-hidden>
          {initial}
        </div>
      )}
      <div className="brs-team-text">
        <div className="brs-team-name-row">
          <span className="brs-team-name">{name}</span>
          {team.is_eliminated ? <span className="brs-out-badge">OUT</span> : null}
        </div>
        {tag ? <span className="brs-team-tag">{tag}</span> : null}
      </div>
    </div>
  );
}

/**
 * Polished BR group standings cards (Group A / Group B side-by-side).
 * @param {{ groups: Array, detailed?: boolean, variant?: "public" | "admin" }} props
 */
function BrStandingsTables({ groups = [], detailed = false, variant = "public" }) {
  if (!groups.length) return null;

  // Prefer stable Group A / Group B order when present
  const ordered = [...groups].sort((a, b) => {
    const an = String(a.group_name || "");
    const bn = String(b.group_name || "");
    if (an === bn) return 0;
    if (an.toLowerCase().includes("group a")) return -1;
    if (bn.toLowerCase().includes("group a")) return 1;
    if (an.toLowerCase().includes("group b")) return -1;
    if (bn.toLowerCase().includes("group b")) return 1;
    return an.localeCompare(bn);
  });

  return (
    <div className={`brs-grid brs-grid--${variant}`}>
      {ordered.map((group) => {
        const rows = [...(group.standings || [])].sort((a, b) => {
          const tp = (b.total_points ?? 0) - (a.total_points ?? 0);
          if (tp !== 0) return tp;
          const k = (b.kills ?? 0) - (a.kills ?? 0);
          if (k !== 0) return k;
          return (a.final_rank ?? 999) - (b.final_rank ?? 999);
        });

        const groupLabel = String(group.group_name || "Group");
        const isA = /group\s*a/i.test(groupLabel);
        const isB = /group\s*b/i.test(groupLabel);

        return (
          <section
            key={groupLabel}
            className={[
              "brs-card",
              isA ? "brs-card--a" : "",
              isB ? "brs-card--b" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <header className="brs-card-header">
              <div className="brs-card-title-wrap">
                <span className="brs-card-eyebrow">Battle Royale</span>
                <h2 className="brs-card-title">{groupLabel}</h2>
              </div>
              <span className="brs-card-count">
                {rows.length} team{rows.length === 1 ? "" : "s"}
              </span>
            </header>

            <div className="brs-table-wrap">
              <table className="brs-table">
                <thead>
                  <tr>
                    <th className="brs-col-rank">Rank</th>
                    <th className="brs-col-team">Team</th>
                    <th className="brs-col-num">Kills</th>
                    <th className="brs-col-num">Placement</th>
                    {detailed ? <th className="brs-col-num">Kill Pts</th> : null}
                    <th className="brs-col-total">Total</th>
                    {detailed ? <th className="brs-col-num">Rounds</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rank = Number(row.final_rank) > 0 ? Number(row.final_rank) : index + 1;
                    return (
                      <tr
                        key={row.id || `${groupLabel}-${row.team_id}`}
                        className={[
                          rank <= 3 ? `brs-row--top${rank}` : "",
                          row.is_eliminated ? "brs-row--out" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td className="brs-col-rank">
                          <RankBadge rank={rank} />
                        </td>
                        <td className="brs-col-team">
                          <TeamCell team={row} />
                        </td>
                        <td className="brs-col-num">{row.kills ?? 0}</td>
                        <td className="brs-col-num">{row.placement_points ?? 0}</td>
                        {detailed ? (
                          <td className="brs-col-num">{row.kill_points ?? 0}</td>
                        ) : null}
                        <td className="brs-col-total">
                          <span className="brs-total-value">{row.total_points ?? 0}</span>
                        </td>
                        {detailed ? (
                          <td className="brs-col-num">{row.rounds_played ?? 0}</td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default BrStandingsTables;
