const DEFAULT_ROUND_MODES = {
  Elimination: "BO1",
  "Top 16": "BO1",
  "Quarter-Finals": "BO3",
  "Semi-Finals": "BO3",
  Finals: "BO5",
};

const PREDEFINED_SEED_ORDERS = {
  1: [1],
  2: [1, 2],
  4: [1, 4, 2, 3],
  8: [1, 8, 4, 5, 3, 6, 2, 7],
  16: [1, 16, 8, 9, 4, 13, 5, 12, 3, 14, 6, 11, 7, 10, 2, 15],
};

function nextPowerOfTwo(n) {
  let value = Math.max(1, Number(n) || 1);
  let power = 1;

  while (power < value) {
    power *= 2;
  }

  return power;
}

function getSeedOrder(bracketSize) {
  const normalizedSize = nextPowerOfTwo(bracketSize);
  if (PREDEFINED_SEED_ORDERS[normalizedSize]) {
    return [...PREDEFINED_SEED_ORDERS[normalizedSize]];
  }

  let currentSize = 16;
  let order = [...PREDEFINED_SEED_ORDERS[16]];

  while (currentSize < normalizedSize) {
    currentSize *= 2;
    order = order.flatMap((seed) => [seed, currentSize + 1 - seed]);
  }

  return order;
}

function getRoundTitle(bracketSize, roundNo) {
  const titlesByBracketSize = {
    2: ["Finals"],
    4: ["Semi-Finals", "Finals"],
    8: ["Quarter-Finals", "Semi-Finals", "Finals"],
    16: ["Top 16", "Quarter-Finals", "Semi-Finals", "Finals"],
    32: ["Elimination", "Top 16", "Quarter-Finals", "Semi-Finals", "Finals"],
  };

  const mappedTitles = titlesByBracketSize[bracketSize];
  if (mappedTitles?.[roundNo - 1]) {
    return mappedTitles[roundNo - 1];
  }

  const teamsRemaining = bracketSize / 2 ** (roundNo - 1);
  if (teamsRemaining === 16) return "Top 16";
  if (teamsRemaining === 8) return "Quarter-Finals";
  if (teamsRemaining === 4) return "Semi-Finals";
  if (teamsRemaining === 2) return "Finals";
  if (teamsRemaining > 16) return `Top ${teamsRemaining}`;

  return `Round ${roundNo}`;
}

function generateSingleEliminationBracket(participants, options = {}) {
  const includeThirdPlace = Boolean(options.includeThirdPlace);
  const normalizedParticipants = [...participants]
    .map((participant) => ({
      team_id: Number(participant.team_id),
      seed: Number(participant.seed),
      name: participant.name || `Team ${participant.team_id}`,
    }))
    .sort((left, right) => left.seed - right.seed);

  const participantCount = normalizedParticipants.length;
  const bracketSize = nextPowerOfTwo(participantCount);
  const byes = bracketSize - participantCount;
  const roundCount = Math.log2(bracketSize);
  const roundModes = options.roundModes || {};
  const participantBySeed = new Map(
    normalizedParticipants.map((participant) => [participant.seed, participant])
  );

  let currentSlots = getSeedOrder(bracketSize).map((seed) => {
    const participant = participantBySeed.get(seed);

    if (participant) {
      return {
        team_id: participant.team_id,
        seed: participant.seed,
        name: participant.name,
        isBye: false,
        sourceRef: null,
        autoAdvanced: false,
      };
    }

    return {
      team_id: null,
      seed,
      name: "BYE",
      isBye: true,
      sourceRef: null,
      autoAdvanced: false,
    };
  });

  const rounds = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const roundNo = roundIndex + 1;
    const title = getRoundTitle(bracketSize, roundNo);
    const mode = roundModes[title] || DEFAULT_ROUND_MODES[title] || "BO1";
    const matches = [];

    for (let slotIndex = 0; slotIndex < currentSlots.length; slotIndex += 2) {
      const teamA = currentSlots[slotIndex];
      const teamB = currentSlots[slotIndex + 1];
      const bracketMatchNo = slotIndex / 2 + 1;
      const bracketMatchRef = `R${roundNo}M${bracketMatchNo}`;
      const teamAIsReal = Boolean(teamA?.team_id) && !teamA?.isBye;
      const teamBIsReal = Boolean(teamB?.team_id) && !teamB?.isBye;
      const isByeMatch =
        (teamAIsReal && (teamB?.isBye || !teamB)) || (teamBIsReal && (teamA?.isBye || !teamA));
      const autoAdvancedTeam =
        teamAIsReal && (teamB?.isBye || !teamB)
          ? teamA
          : teamBIsReal && (teamA?.isBye || !teamA)
            ? teamB
            : null;

      matches.push({
        bracket_match_no: bracketMatchNo,
        bracket_match_ref: bracketMatchRef,
        round_no: roundNo,
        match_index: bracketMatchNo - 1,
        seed_a: teamA?.seed ?? null,
        seed_b: teamB?.seed ?? null,
        team_a_id: teamA?.team_id ?? null,
        team_b_id: teamB?.team_id ?? null,
        team_a_name: teamA?.name || "TBD",
        team_b_name: teamB?.name || "TBD",
        team_a_source_ref: teamA?.sourceRef || null,
        team_b_source_ref: teamB?.sourceRef || null,
        team_a_auto_advanced: Boolean(teamA?.autoAdvanced),
        team_b_auto_advanced: Boolean(teamB?.autoAdvanced),
        has_bye: Boolean(teamA?.isBye || teamB?.isBye),
        is_bye_match: isByeMatch,
        should_display: !(roundNo === 1 && isByeMatch),
        auto_advanced_team_id: autoAdvancedTeam?.team_id ?? null,
        auto_advanced_team_name: autoAdvancedTeam?.name ?? null,
        auto_advanced_seed: autoAdvancedTeam?.seed ?? null,
        auto_advanced_from_ref: autoAdvancedTeam ? bracketMatchRef : null,
        next_match_ref: roundNo < roundCount ? `R${roundNo + 1}M${Math.ceil(bracketMatchNo / 2)}` : null,
        next_slot: bracketMatchNo % 2 === 1 ? "a" : "b",
        source_a_ref: teamA?.sourceRef || null,
        source_b_ref: teamB?.sourceRef || null,
      });
    }

    rounds.push({
      round_no: roundNo,
      title,
      mode,
      matches,
    });

    currentSlots = matches.map((match) => {
      if (match.auto_advanced_team_id) {
        return {
          team_id: match.auto_advanced_team_id,
          seed: match.auto_advanced_seed,
          name: match.auto_advanced_team_name,
          isBye: false,
          sourceRef: match.auto_advanced_from_ref,
          autoAdvanced: true,
        };
      }

      return {
        team_id: null,
        seed: null,
        name: `Winner of ${match.bracket_match_ref}`,
        isBye: false,
        sourceRef: match.bracket_match_ref,
        autoAdvanced: false,
      };
    });
  }

  const displayNoByRef = new Map();
  let displayMatchNo = 1;
  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.should_display === false) {
        match.display_match_no = null;
        return;
      }

      match.display_match_no = displayMatchNo;
      displayNoByRef.set(match.bracket_match_ref, displayMatchNo);
      displayMatchNo += 1;
    });
  });

  const formatPublicSourceLabel = (sourceRef) => {
    if (!sourceRef) {
      return null;
    }

    const displayNo = displayNoByRef.get(sourceRef);
    return displayNo ? `Match ${displayNo}` : sourceRef;
  };

  const formatWinnerLabel = (sourceRef) => {
    const publicSourceLabel = formatPublicSourceLabel(sourceRef);
    if (!publicSourceLabel) {
      return null;
    }

    return displayNoByRef.has(sourceRef)
      ? `Winner of ${publicSourceLabel}`
      : `Winner of ${sourceRef}`;
  };

  const formatLoserLabel = (sourceRef) => {
    const publicSourceLabel = formatPublicSourceLabel(sourceRef);
    if (!publicSourceLabel) {
      return null;
    }

    return displayNoByRef.has(sourceRef)
      ? `Loser of ${publicSourceLabel}`
      : `Loser of ${sourceRef}`;
  };

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (typeof match.team_a_name === "string" && match.team_a_name.startsWith("Winner of ")) {
        match.team_a_name = formatWinnerLabel(match.team_a_source_ref) || match.team_a_name;
      }

      if (typeof match.team_b_name === "string" && match.team_b_name.startsWith("Winner of ")) {
        match.team_b_name = formatWinnerLabel(match.team_b_source_ref) || match.team_b_name;
      }

      if (typeof match.team_a_name === "string" && match.team_a_name.startsWith("Loser of ")) {
        match.team_a_name = formatLoserLabel(match.team_a_source_ref) || match.team_a_name;
      }

      if (typeof match.team_b_name === "string" && match.team_b_name.startsWith("Loser of ")) {
        match.team_b_name = formatLoserLabel(match.team_b_source_ref) || match.team_b_name;
      }
    });
  });

  let thirdPlaceMatch = null;
  const semifinalRound = rounds.length >= 2 ? rounds[rounds.length - 2] : null;

  if (includeThirdPlace && semifinalRound?.matches?.length === 2) {
    const [semifinalA, semifinalB] = semifinalRound.matches;
    thirdPlaceMatch = {
      title: "Battle for Third",
      mode:
        options.thirdPlaceMode ||
        roundModes["Battle for Third"] ||
        DEFAULT_ROUND_MODES["Battle for Third"] ||
        "BO3",
      bracket_match_ref: "B3M1",
      source_a_ref: semifinalA.bracket_match_ref,
      source_b_ref: semifinalB.bracket_match_ref,
      team_a_name: `Loser of ${formatPublicSourceLabel(semifinalA.bracket_match_ref) || semifinalA.bracket_match_ref}`,
      team_b_name: `Loser of ${formatPublicSourceLabel(semifinalB.bracket_match_ref) || semifinalB.bracket_match_ref}`,
      team_a_id: null,
      team_b_id: null,
      seed_a: null,
      seed_b: null,
      has_bye: false,
      is_third_place: true,
      display_match_no: null,
    };
  }

  return {
    bracket_size: bracketSize,
    participant_count: participantCount,
    byes,
    rounds,
    third_place_match: thirdPlaceMatch,
  };
}

module.exports = {
  nextPowerOfTwo,
  getSeedOrder,
  generateSingleEliminationBracket,
};
