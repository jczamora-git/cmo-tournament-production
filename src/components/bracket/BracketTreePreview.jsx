import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const bracketRoundStyle = {
  minWidth: "228px",
  flex: "0 0 228px",
};

const bracketRoundHeaderStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginBottom: "14px",
  padding: "0 2px",
};

const bracketRoundMatchesBaseStyle = {
  display: "flex",
  flexDirection: "column",
};

const bracketMatchCardStyle = {
  position: "relative",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(8, 13, 24, 0.92)",
  borderRadius: "10px",
  overflow: "visible",
};

const bracketMatchTitleStyle = {
  padding: "8px 12px 7px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255, 255, 255, 0.72)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
};

const bracketTeamRowStyle = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) 62px",
  alignItems: "center",
  gap: "8px",
  minHeight: "34px",
  padding: "0 12px",
};

const bracketSeedStyle = {
  fontSize: "12px",
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.55)",
};

const bracketTeamNameStyle = {
  minWidth: 0,
  fontSize: "13px",
  fontWeight: 600,
  color: "#f7f8fb",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const bracketScoreStyle = {
  textAlign: "right",
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.42)",
};

const byeBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "40px",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "rgba(255, 94, 0, 0.16)",
  color: "#ff9b61",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const autoAdvanceBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px 6px",
  borderRadius: "999px",
  background: "rgba(34, 197, 94, 0.12)",
  color: "rgba(134, 239, 172, 0.95)",
  border: "1px solid rgba(34, 197, 94, 0.18)",
  fontSize: "9px",
  fontWeight: 700,
  lineHeight: "1.1",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

function getRoundSpacing(roundIndex, variant) {
  const baseSpacing = variant === "full" ? 24 : 18;
  return Math.pow(2, roundIndex) * baseSpacing;
}

function getRoundPaddingTop(roundIndex, variant) {
  const extraPadding = variant === "full" ? 28 : 20;
  return roundIndex === 0 ? 0 : getRoundSpacing(roundIndex - 1, variant) / 2 + extraPadding;
}

function buildDisplayNoByRef(preview) {
  const displayNoByRef = new Map();

  preview?.rounds?.forEach((round) => {
    round.matches?.forEach((match) => {
      if (match.bracket_match_ref && match.display_match_no) {
        displayNoByRef.set(match.bracket_match_ref, match.display_match_no);
      }
    });
  });

  return displayNoByRef;
}

function resolvePublicMatchLabel(sourceRef, displayNoByRef, fallbackPrefix) {
  if (!sourceRef) {
    return null;
  }

  const displayNo = displayNoByRef.get(sourceRef);
  return displayNo ? `${fallbackPrefix} Match ${displayNo}` : `${fallbackPrefix} ${sourceRef}`;
}

function normalizePlaceholderLabel(label, sourceRef, displayNoByRef, fallbackPrefix) {
  if (typeof label !== "string") {
    return label;
  }

  if (label.startsWith(`${fallbackPrefix} Match `)) {
    return label;
  }

  if (label.startsWith(`${fallbackPrefix} `) || label.startsWith("Winner of ") || label.startsWith("Loser of ")) {
    return resolvePublicMatchLabel(sourceRef, displayNoByRef, fallbackPrefix) || label;
  }

  return label;
}

function getMatchSlotDisplay(match, slotKey) {
  const teamName = match[`team_${slotKey}_name`];
  const seed = match[`seed_${slotKey}`];
  const sourceRef = match[`team_${slotKey}_source_ref`];
  const teamId = match[`team_${slotKey}_id`];
  const isBye = String(teamName).toUpperCase() === "BYE";
  const isAutoAdvanced = Boolean(match[`team_${slotKey}_auto_advanced`]);
  const nameStr = String(teamName || "");
  const isWaitingLabel =
    nameStr.startsWith("Waiting:") ||
    nameStr.startsWith("Winner of ") ||
    nameStr.startsWith("Loser of ");
  // Known team (real name or team_id) — never show ADVANCE badge
  const hasActualTeam =
    (Boolean(teamName) && !isBye && !isWaitingLabel) ||
    (teamId != null && Number(teamId) > 0 && !isWaitingLabel);

  if (hasActualTeam) {
    return {
      seed: seed ?? "-",
      name: teamName || `Team #${teamId}`,
      // ADVANCE removed: known team is shown cleanly (with score in parent)
      badge: null,
      isBye: false,
      isWaiting: false,
      isKnown: true,
    };
  }

  if (isWaitingLabel) {
    return {
      seed: seed ?? "-",
      name: teamName,
      badge: null,
      isBye: false,
      isWaiting: true,
      isKnown: false,
    };
  }

  // Pure bye auto-advance placeholder without a settled opponent label:
  // still show the team name but no ADVANCE chip (keeps bracket readable)
  if (isAutoAdvanced && match.auto_advanced_team_name) {
    return {
      seed: match.auto_advanced_seed ?? seed ?? "-",
      name: match.auto_advanced_team_name,
      badge: null,
      isBye: false,
      isWaiting: false,
      isKnown: true,
    };
  }

  if (sourceRef) {
    return {
      seed: seed ?? "-",
      name: `Winner of ${sourceRef}`,
      badge: null,
      isBye: false,
      isWaiting: true,
      isKnown: false,
    };
  }

  if (isBye) {
    return {
      seed: seed ?? "-",
      name: "BYE",
      badge: "BYE",
      isBye: true,
      isWaiting: false,
      isKnown: false,
    };
  }

  return {
    seed: seed ?? "-",
    name: teamName || "TBD",
    badge: null,
    isBye: false,
    isWaiting: false,
    isKnown: false,
  };
}

function BracketTreePreview({ preview, variant = "controller" }) {
  const treeRef = useRef(null);
  const matchRefs = useRef(new Map());
  const [connectorState, setConnectorState] = useState({ paths: [], width: 0, height: 0 });
  const isFullVariant = variant === "full";
  const displayNoByRef = useMemo(() => buildDisplayNoByRef(preview), [preview]);

  useLayoutEffect(() => {
    if (!preview || !treeRef.current) {
      setConnectorState({ paths: [], width: 0, height: 0 });
      return undefined;
    }

    let frameId = 0;

    const measureConnectors = () => {
      const treeNode = treeRef.current;
      if (!treeNode) {
        return;
      }

      const treeRect = treeNode.getBoundingClientRect();
      const nextPaths = [];

      preview.rounds?.forEach((round) => {
        round.matches
          ?.filter((match) => match.should_display !== false)
          .forEach((match) => {
            const destinationNode = matchRefs.current.get(match.bracket_match_ref);
            if (!destinationNode) {
              return;
            }

            const destinationRect = destinationNode.getBoundingClientRect();
            const destinationLeftX = destinationRect.left - treeRect.left;
            const destinationMidY =
              destinationRect.top + destinationRect.height / 2 - treeRect.top;

            [match.source_a_ref, match.source_b_ref].forEach((sourceRef) => {
              if (!sourceRef) {
                return;
              }

              const sourceNode = matchRefs.current.get(sourceRef);
              if (!sourceNode) {
                return;
              }

              const sourceRect = sourceNode.getBoundingClientRect();
              const sourceRightX = sourceRect.right - treeRect.left;
              const sourceMidY = sourceRect.top + sourceRect.height / 2 - treeRect.top;
              const midX = sourceRightX + (destinationLeftX - sourceRightX) / 2;

              nextPaths.push(
                `M ${sourceRightX} ${sourceMidY} H ${midX} V ${destinationMidY} H ${destinationLeftX}`
              );
            });
          });
      });

      setConnectorState({
        paths: nextPaths,
        width: treeNode.scrollWidth,
        height: treeNode.scrollHeight,
      });
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measureConnectors);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [preview, variant]);

  useEffect(() => {
    if (!preview) {
      return undefined;
    }

    let frameId = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });

    return () => cancelAnimationFrame(frameId);
  }, [preview, variant]);

  if (!preview) {
    return null;
  }

  return (
    <div className={`bracket-tree-shell bracket-tree-shell-${variant} bracket-tree-wide`} ref={treeRef}>
      <svg
        className="bracket-connector-overlay"
        width={connectorState.width}
        height={connectorState.height}
        viewBox={`0 0 ${connectorState.width || 1} ${connectorState.height || 1}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {connectorState.paths.map((path, index) => (
          <path key={`${index}-${path}`} d={path} className="bracket-connector-path" />
        ))}
      </svg>

      <div className="bracket-tree">
        {preview.rounds?.map((round, roundIndex) => {
          const visibleMatches =
            round.matches?.filter((match) => match.should_display !== false) || [];

          return (
            <div
              key={round.round_no}
              className="bracket-round"
              style={{
                ...bracketRoundStyle,
                minWidth: isFullVariant ? "256px" : bracketRoundStyle.minWidth,
                flex: isFullVariant ? "0 0 256px" : bracketRoundStyle.flex,
              }}
            >
              <div className="bracket-round-header" style={bracketRoundHeaderStyle}>
                <strong>{round.title}</strong>
                <div className="helper-text">{round.mode}</div>
                <div className="helper-text">
                  {visibleMatches.length || 0} match
                  {visibleMatches.length === 1 ? "" : "es"}
                </div>
              </div>

              <div
                className="bracket-round-matches"
                style={{
                  ...bracketRoundMatchesBaseStyle,
                  gap: `${getRoundSpacing(roundIndex, variant)}px`,
                  paddingTop: `${getRoundPaddingTop(roundIndex, variant)}px`,
                }}
              >
                {visibleMatches.map((match) => {
                  const teamA = getMatchSlotDisplay(match, "a");
                  const teamB = getMatchSlotDisplay(match, "b");
                  const displayTeamAName = teamA.isWaiting
                    ? teamA.name
                    : normalizePlaceholderLabel(
                        teamA.name,
                        match.team_a_source_ref,
                        displayNoByRef,
                        "Winner of"
                      );
                  const displayTeamBName = teamB.isWaiting
                    ? teamB.name
                    : normalizePlaceholderLabel(
                        teamB.name,
                        match.team_b_source_ref,
                        displayNoByRef,
                        "Winner of"
                      );
                  const isFinished = Boolean(match.is_finished);
                  const winnerId = match.series_winner_team_id
                    ? Number(match.series_winner_team_id)
                    : null;
                  const aWon = winnerId && Number(match.team_a_id) === winnerId;
                  const bWon = winnerId && Number(match.team_b_id) === winnerId;
                  const scoreA =
                    match.blue_score != null && match.blue_score !== ""
                      ? match.blue_score
                      : null;
                  const scoreB =
                    match.red_score != null && match.red_score !== ""
                      ? match.red_score
                      : null;

                  return (
                    <div
                      key={`${round.round_no}-${match.bracket_match_no}`}
                      className={`bracket-match-card${isFinished ? " bracket-match-finished" : ""}`}
                      style={{
                        ...bracketMatchCardStyle,
                        ...(isFinished
                          ? {
                              borderColor: "rgba(34, 197, 94, 0.45)",
                              boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.12)",
                            }
                          : {}),
                      }}
                      ref={(node) => {
                        if (node) {
                          matchRefs.current.set(match.bracket_match_ref, node);
                        } else {
                          matchRefs.current.delete(match.bracket_match_ref);
                        }
                      }}
                      data-match-ref={match.bracket_match_ref}
                    >
                      <div style={bracketMatchTitleStyle}>
                        <span>{`MATCH ${match.display_match_no ?? match.bracket_match_no}`}</span>
                        {isFinished ? (
                          <span
                            style={{
                              marginLeft: "8px",
                              color: "#4ade80",
                              fontSize: "10px",
                              letterSpacing: "0.06em",
                            }}
                          >
                            FINISHED
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="bracket-team-row"
                        style={{
                          ...bracketTeamRowStyle,
                          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                          ...(aWon ? { background: "rgba(34, 197, 94, 0.08)" } : {}),
                        }}
                      >
                        <span style={bracketSeedStyle}>{teamA.seed}</span>
                        <span
                          style={{
                            ...bracketTeamNameStyle,
                            ...(teamA.isWaiting ? { color: "#fb923c", fontStyle: "italic" } : {}),
                            ...(aWon ? { color: "#86efac" } : {}),
                          }}
                        >
                          {displayTeamAName}
                        </span>
                        <span style={bracketScoreStyle}>
                          {teamA.badge === "BYE" ? (
                            <span style={byeBadgeStyle}>BYE</span>
                          ) : teamA.isKnown || isFinished ? (
                            scoreA != null ? scoreA : teamA.isKnown ? "0" : "-"
                          ) : teamA.badge ? (
                            <span style={autoAdvanceBadgeStyle}>{teamA.badge}</span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </div>
                      <div
                        className="bracket-team-row"
                        style={{
                          ...bracketTeamRowStyle,
                          ...(bWon ? { background: "rgba(34, 197, 94, 0.08)" } : {}),
                        }}
                      >
                        <span style={bracketSeedStyle}>{teamB.seed}</span>
                        <span
                          style={{
                            ...bracketTeamNameStyle,
                            ...(teamB.isWaiting ? { color: "#fb923c", fontStyle: "italic" } : {}),
                            ...(bWon ? { color: "#86efac" } : {}),
                          }}
                        >
                          {displayTeamBName}
                        </span>
                        <span style={bracketScoreStyle}>
                          {teamB.badge === "BYE" ? (
                            <span style={byeBadgeStyle}>BYE</span>
                          ) : teamB.isKnown || isFinished ? (
                            scoreB != null ? scoreB : teamB.isKnown ? "0" : "-"
                          ) : teamB.badge ? (
                            <span style={autoAdvanceBadgeStyle}>{teamB.badge}</span>
                          ) : (
                            "-"
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {preview.third_place_match ? (
        (() => {
          const tp = preview.third_place_match;
          const tpFinished = Boolean(tp.is_finished);
          const tpWinnerId = tp.series_winner_team_id
            ? Number(tp.series_winner_team_id)
            : null;
          const tpAWon = tpWinnerId && Number(tp.team_a_id) === tpWinnerId;
          const tpBWon = tpWinnerId && Number(tp.team_b_id) === tpWinnerId;
          const tpScoreA =
            tp.blue_score != null && tp.blue_score !== "" ? tp.blue_score : null;
          const tpScoreB =
            tp.red_score != null && tp.red_score !== "" ? tp.red_score : null;
          const tpNameA = normalizePlaceholderLabel(
            tp.team_a_name,
            tp.team_a_source_ref || tp.source_a_ref,
            displayNoByRef,
            "Loser of"
          );
          const tpNameB = normalizePlaceholderLabel(
            tp.team_b_name,
            tp.team_b_source_ref || tp.source_b_ref,
            displayNoByRef,
            "Loser of"
          );
          const isWaitingA =
            typeof tpNameA === "string" &&
            (tpNameA.startsWith("Waiting:") ||
              tpNameA.startsWith("Winner of ") ||
              tpNameA.startsWith("Loser of "));
          const isWaitingB =
            typeof tpNameB === "string" &&
            (tpNameB.startsWith("Waiting:") ||
              tpNameB.startsWith("Winner of ") ||
              tpNameB.startsWith("Loser of "));

          return (
            <section
              className={`modern-card bracket-third-place-card bracket-third-place-panel bracket-third-place-panel-${variant}`}
            >
              <div className="panel-header">
                <h2>3rd Place Match</h2>
                {tp.mode ? <span className="helper-text">{tp.mode}</span> : null}
              </div>
              <div
                className={`bracket-match-card${tpFinished ? " bracket-match-finished" : ""}`}
                style={{
                  ...bracketMatchCardStyle,
                  ...(tpFinished
                    ? {
                        borderColor: "rgba(34, 197, 94, 0.45)",
                        boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.12)",
                      }
                    : {}),
                }}
              >
                <div style={bracketMatchTitleStyle}>
                  <span>BATTLE FOR THIRD</span>
                  {tpFinished ? (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: "#4ade80",
                        fontSize: "10px",
                        letterSpacing: "0.06em",
                      }}
                    >
                      FINISHED
                    </span>
                  ) : null}
                </div>
                <div
                  className="bracket-team-row"
                  style={{
                    ...bracketTeamRowStyle,
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    ...(tpAWon ? { background: "rgba(34, 197, 94, 0.08)" } : {}),
                  }}
                >
                  <span style={bracketSeedStyle}>{tp.seed_a ?? "-"}</span>
                  <span
                    style={{
                      ...bracketTeamNameStyle,
                      ...(isWaitingA ? { color: "#fb923c", fontStyle: "italic" } : {}),
                      ...(tpAWon ? { color: "#86efac" } : {}),
                    }}
                  >
                    {tpNameA || "TBD"}
                  </span>
                  <span style={bracketScoreStyle}>
                    {tpScoreA != null ? tpScoreA : tp.team_a_id || tpFinished ? "0" : "-"}
                  </span>
                </div>
                <div
                  className="bracket-team-row"
                  style={{
                    ...bracketTeamRowStyle,
                    ...(tpBWon ? { background: "rgba(34, 197, 94, 0.08)" } : {}),
                  }}
                >
                  <span style={bracketSeedStyle}>{tp.seed_b ?? "-"}</span>
                  <span
                    style={{
                      ...bracketTeamNameStyle,
                      ...(isWaitingB ? { color: "#fb923c", fontStyle: "italic" } : {}),
                      ...(tpBWon ? { color: "#86efac" } : {}),
                    }}
                  >
                    {tpNameB || "TBD"}
                  </span>
                  <span style={bracketScoreStyle}>
                    {tpScoreB != null ? tpScoreB : tp.team_b_id || tpFinished ? "0" : "-"}
                  </span>
                </div>
              </div>
            </section>
          );
        })()
      ) : null}
    </div>
  );
}

export default BracketTreePreview;
