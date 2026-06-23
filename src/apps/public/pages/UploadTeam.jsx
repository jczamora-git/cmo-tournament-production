import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { submitTeam, getTournaments } from "../../../services/api";
import { apiUrl } from "../../../config/api";

const isDatabaseTrue = (value) => value === true || value === 1 || value === "1" || value === "true";
const REGISTRATION_STATUSES = new Set(["upcoming", "ongoing"]);
const isRegistrationTournament = (tournament) => {
  const status = String(tournament?.status || "").trim().toLowerCase();
  return isDatabaseTrue(tournament?.is_active) && REGISTRATION_STATUSES.has(status);
};

function getTournamentInitials(name) {
  return String(name || "Tournament")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function getModeSelectLabel(mode) {
  const code = String(mode?.code || "")
    .trim()
    .toUpperCase();

  switch (code) {
    case "MP":
      return "Select MP Mode";

    case "BR":
      return "Select BR Mode";

    case "MOBA":
      return "Select MOBA";

    case "MAGIC_CHESS":
      return "Select Magic Chess";

    default: {
      const name = String(
        mode?.name || code || "Division"
      ).trim();

      return `Select ${name}`;
    }
  }
}

function getModeBadgeLabel(mode) {
  const code = String(mode?.code || "")
    .trim()
    .toUpperCase();

  if (code === "MAGIC_CHESS") {
    return "MAGIC CHESS";
  }

  return code || "MODE";
}

function truncateModeCaption(value, maxLength = 12) {
  const text = String(value || "").trim().toUpperCase();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function getModeTileContent(mode) {
  const code = String(mode?.code || "")
    .trim()
    .toUpperCase();

  switch (code) {
    case "MP":
      return {
        heading: "MP",
        caption: "MULTIPLAYER",
      };

    case "BR":
      return {
        heading: "BR",
        caption: "BATTLE ROYALE",
      };

    case "MOBA":
      return {
        heading: "MOBA",
        caption: "5V5",
      };

    case "MAGIC_CHESS":
      return {
        heading: "MAGIC",
        caption: "ARCADE MODE",
      };

    default:
      return {
        heading: code || "MODE",
        caption: String(mode?.name || "SELECT")
          .trim()
          .toUpperCase(),
      };
  }
}

const MODE_CARD_IMAGES = {
  CODM: {
    MP: "/codm-mp.png",
    BR: "/codm-br.png",
  },
  MLBB: {
    MOBA: "/mlbb-moba.png",
    MAGIC_CHESS: "/mlbb-magic_chess.png",
  },
  HOK: {
    MOBA: "/hok_moba.png",
  },
};

function getModeCardImage(gameType, modeCode) {
  const normalizedGame = String(gameType || "")
    .trim()
    .toUpperCase();

  const normalizedMode = String(modeCode || "")
    .trim()
    .toUpperCase();

  return (
    MODE_CARD_IMAGES[normalizedGame]?.[
      normalizedMode
    ] || null
  );
}

function UploadTeam() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({
    team_name: "",
    shortname: "",
    captain_name: "",
    contact: "",
    logo_url: "",
    notes: "",
    tournament_id: "",
    tournament_mode_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [success, setSuccess] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileRef = useRef(null);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [uploadEnabled, setUploadEnabled] = useState(true);
  const [closedMessage, setClosedMessage] = useState("");

  const [tournaments, setTournaments] = useState([]);
  const [modes, setModes] = useState([]);
  const [modesLoading, setModesLoading] = useState(false);
  const [modesLoadError, setModesLoadError] = useState("");
  const [modesReloadKey, setModesReloadKey] = useState(0);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);

  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [selectionModal, setSelectionModal] = useState(null);

  const modeTrackRef = useRef(null);
  const [activeModeIndex, setActiveModeIndex] = useState(0);

  const canChangeTournament = tournaments.length > 1;
  const canChangeMode = modes.length > 1;
  const canChangeSelection = canChangeTournament || canChangeMode;

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/public-settings"), { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          setUploadEnabled(data.team_upload_enabled !== false);
          setClosedMessage(data.team_upload_closed_message || "Team registration and logo upload are now closed.");
        })
        .catch(() => {
          setUploadEnabled(true);
        }),
      getTournaments()
        .then((data) => {
          const eligible = (data || []).filter(isRegistrationTournament);
          eligible.sort((a, b) => {
            const statusA = String(a.status).trim().toLowerCase();
            const statusB = String(b.status).trim().toLowerCase();
            if (statusA !== statusB) {
              if (statusA === "ongoing") return -1;
              if (statusB === "ongoing") return 1;
            }
            if (a.start_date && b.start_date) {
              return new Date(a.start_date) - new Date(b.start_date);
            }
            return (a.name || "").localeCompare(b.name || "");
          });
          setTournaments(eligible);
        })
        .catch(() => setTournaments([])),
    ]).finally(() => setSettingsLoading(false));
  }, []);

  useEffect(() => {
    if (settingsLoading || selectionInitialized) return;
    
    if (!uploadEnabled || tournaments.length === 0) {
      setSelectionInitialized(true);
      return;
    }

    const tParam = searchParams.get("tournament");
    let foundTournament = null;

    if (tParam) {
      foundTournament = tournaments.find((t) => String(t.id) === tParam);
      if (!foundTournament) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("tournament");
        newParams.delete("mode");
        setSearchParams(newParams, { replace: true });
      }
    }

    if (!foundTournament && tournaments.length === 1) {
      foundTournament = tournaments[0];
    }

    if (foundTournament) {
      setSelectedTournament(foundTournament);
      setForm((prev) => ({ ...prev, tournament_id: String(foundTournament.id) }));
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tournament", foundTournament.id);
      setSearchParams(newParams, { replace: true });
    } else {
      setSelectionModal("tournament");
    }

    setSelectionInitialized(true);
  }, [settingsLoading, selectionInitialized, uploadEnabled, tournaments, searchParams, setSearchParams]);

  useEffect(() => {
    let isMounted = true;

    if (!form.tournament_id) {
      setModes([]);
      setModesLoading(false);
      setModesLoadError("");
      return () => {
        isMounted = false;
      };
    }

    setModesLoading(true);
    setModesLoadError("");
    setModes([]);

    fetch(
      apiUrl(
        `/api/tournaments/${form.tournament_id}/modes`
      ),
      {
        cache: "no-store",
      }
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Unable to load divisions: ${res.status}`
          );
        }

        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;

        const uploadModes = (data || []).filter(
          (mode) =>
            isDatabaseTrue(mode.is_active) &&
            isDatabaseTrue(
              mode.team_upload_enabled
            ) &&
            String(mode.tournament_id) ===
              String(form.tournament_id)
        );

        setModes(uploadModes);

        if (!form.tournament_mode_id) {
          const modeParam =
            searchParams.get("mode");

          let foundMode = null;

          if (modeParam) {
            foundMode = uploadModes.find(
              (mode) =>
                String(mode.id) === modeParam
            );

            if (!foundMode) {
              const nextParams =
                new URLSearchParams(
                  searchParams
                );

              nextParams.delete("mode");

              setSearchParams(nextParams, {
                replace: true,
              });
            }
          }

          if (
            !foundMode &&
            uploadModes.length === 1
          ) {
            foundMode = uploadModes[0];
          }

          if (foundMode) {
            setSelectedMode(foundMode);

            setForm((current) => ({
              ...current,
              tournament_mode_id:
                String(foundMode.id),
            }));

            const nextParams =
              new URLSearchParams(searchParams);

            nextParams.set(
              "mode",
              foundMode.id
            );

            setSearchParams(nextParams, {
              replace: true,
            });

            setSelectionModal(null);
          } else if (
            uploadModes.length > 1
          ) {
            setSelectionModal("mode");
          } else {
            setSelectionModal(null);
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;

        setModes([]);
        setSelectionModal(null);
        setModesLoadError(
          "We could not load the available divisions. Please try again."
        );
      })
      .finally(() => {
        if (isMounted) {
          setModesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    form.tournament_id,
    modesReloadKey,
  ]);

  useEffect(() => {
    if (
      selectionModal !== "mode" ||
      !modes.length
    ) {
      return;
    }

    setActiveModeIndex(0);

    const frame = window.requestAnimationFrame(
      () => {
        const track = modeTrackRef.current;

        if (track) {
          track.scrollTo({
            left: 0,
            behavior: "auto",
          });
        }
      }
    );

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    selectionModal,
    modes.length,
  ]);

  function scrollToModeCard(requestedIndex) {
    const track = modeTrackRef.current;

    if (!track || !modes.length) return;

    const cards = Array.from(track.children);

    const nextIndex = Math.max(
      0,
      Math.min(requestedIndex, cards.length - 1)
    );

    const card = cards[nextIndex];

    if (!card) return;

    track.scrollTo({
      left: card.offsetLeft,
      behavior: "smooth",
    });

    setActiveModeIndex(nextIndex);
  }

  function handleModeTrackScroll() {
    const track = modeTrackRef.current;

    if (!track) return;

    const cards = Array.from(track.children);

    if (!cards.length) return;

    const viewportCenter =
      track.scrollLeft + track.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter =
        card.offsetLeft + card.clientWidth / 2;

      const distance = Math.abs(
        cardCenter - viewportCenter
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveModeIndex(closestIndex);
  }

  const VALID_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleTournamentSelect = (t) => {
    setSelectedTournament(t);
    setForm((prev) => ({ ...prev, tournament_id: String(t.id), tournament_mode_id: "" }));
    setSelectedMode(null);
    setSelectionModal(null);
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tournament", t.id);
    newParams.delete("mode");
    setSearchParams(newParams, { replace: true });
  };

  const applyModeSelection = (m) => {
    if (!selectedTournament) return;
    if (Number(m.tournament_id) !== Number(selectedTournament.id)) return;

    setSelectedMode(m);
    setForm((prev) => ({ ...prev, tournament_id: String(selectedTournament.id), tournament_mode_id: String(m.id) }));
    setSelectionModal(null);
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tournament", selectedTournament.id);
    newParams.set("mode", m.id);
    setSearchParams(newParams, { replace: true });
  };

  const handleChangeSelection = () => {
    if (canChangeTournament) {
      setSelectedTournament(null);
      setSelectedMode(null);
      setForm((current) => ({
        ...current,
        tournament_id: "",
        tournament_mode_id: "",
      }));
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("tournament");
      newParams.delete("mode");
      setSearchParams(newParams, { replace: true });
      
      setSelectionModal("tournament");
      return;
    }

    if (canChangeMode) {
      setSelectedMode(null);
      setForm((current) => ({
        ...current,
        tournament_mode_id: "",
      }));
      
      const newParams = new URLSearchParams(searchParams);
      if (selectedTournament) {
        newParams.set("tournament", selectedTournament.id);
      }
      newParams.delete("mode");
      setSearchParams(newParams, { replace: true });
      
      setSelectionModal("mode");
    }
  };

  const reopenRequiredSelection = () => {
    if (!selectedTournament) {
      if (canChangeTournament) {
        setSelectionModal("tournament");
        return;
      }
      if (tournaments.length === 1) {
        handleTournamentSelect(tournaments[0]);
        return;
      }
    }

    if (!selectedMode) {
      if (canChangeMode) {
        setSelectionModal("mode");
        return;
      }
      if (modes.length === 1) {
        applyModeSelection(modes[0]);
      }
    }
  };

  const triggerFileSelect = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploadStatus("");
    setUploading(true);

    if (!VALID_TYPES.has(file.type)) {
      setUploadError("Invalid file type. Please upload PNG, JPG, or WebP.");
      setUploading(false);
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setUploadError("Logo file is too large. Please upload an image under 3MB.");
      setUploading(false);
      return;
    }

    try {
      setUploadStatus("Optimizing logo...");
      const { compressToWebp } = await import("../../../utils/imageCompressor");
      const webpBlob = await compressToWebp(file);

      const safeFile = new File(
        [webpBlob],
        `team-logo-${Date.now()}.webp`,
        { type: "image/webp" },
      );

      setUploadStatus("Uploading logo...");
      const formData = new FormData();
      formData.append("file", safeFile);

      const res = await fetch(apiUrl("/api/uploads/team-logo"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload failed");
      }

      const data = await res.json();
      setForm((prev) => ({ ...prev, logo_url: data.url }));
      setUploadedFileName(safeFile.name);
      setUploadStatus("Logo uploaded successfully");
    } catch (err) {
      setUploadError("Logo upload failed. Please try another image.");
      setUploadStatus("");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: "" }));
    setUploadedFileName("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || uploading) return;
    setError("");
    setSuccess("");

    if (!form.tournament_id) {
      setError("Please select a tournament");
      return;
    }
    if (!form.tournament_mode_id) {
      setError("Please select a division / mode");
      return;
    }
    if (!form.team_name.trim()) {
      setError("Team name is required");
      return;
    }
    if (!form.captain_name.trim()) {
      setError("Captain name is required");
      return;
    }
    if (!form.contact.trim()) {
      setError("Contact number or messenger link is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        tournament_id: Number(form.tournament_id),
        tournament_mode_id: Number(form.tournament_mode_id),
      };
      await submitTeam(payload);
      setShowSuccessModal(true);
      
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="ph-section team-upload-page" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2 style={{ color: "#94a3b8" }}>Loading...</h2>
      </div>
    );
  }

  if (!uploadEnabled || (selectionInitialized && tournaments.length === 0)) {
    return (
      <div className="ph-section team-upload-page">
        <div className="team-registration-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>🔒</div>
          <h2 style={{ fontSize: "24px", color: "#f8fafc", marginBottom: "16px" }}>
            {uploadEnabled ? "Registration Unavailable" : "Team Registration Closed"}
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "32px", lineHeight: "1.6" }}>
            {uploadEnabled ? "No tournament is currently open for team registration." : closedMessage}
          </p>
          <button 
            type="button" 
            className="ph-btn ph-btn-primary" 
            onClick={() => navigate("/")}
            style={{ minWidth: "200px" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const selectionComplete = Boolean(selectedTournament) && Boolean(selectedMode) && Boolean(form.tournament_id) && Boolean(form.tournament_mode_id);
  const noModesAvailable =
    Boolean(selectedTournament) &&
    !modesLoading &&
    !modesLoadError &&
    modes.length === 0;
  const showBlankStateFallback =
    !loading &&
    !modesLoading &&
    !modesLoadError &&
    !selectionModal &&
    !selectedMode &&
    tournaments.length > 0 &&
    selectionInitialized &&
    !noModesAvailable &&
    !selectionComplete;

  const changeSelectionLabel = canChangeTournament ? "Change Tournament / Division" : canChangeMode ? "Change Division" : null;

  const registrationModeLabel = String(
    selectedMode?.code ||
    selectedMode?.name ||
    ""
  )
    .replaceAll("_", " ")
    .trim();

  const registrationTournamentLabel = selectedTournament
    ? selectedTournament.name
    : "";

  const registrationSubtitle =
    registrationTournamentLabel &&
    registrationModeLabel
      ? `Submit your squad for ${registrationTournamentLabel} — ${registrationModeLabel} Division.`
      : "Submit your squad for the selected tournament division.";

  return (
    <div className="ph-section team-upload-page">
      <section className="registration-page-heading">
        <h1>Register Team</h1>

        <p>{registrationSubtitle}</p>
      </section>

      {selectionModal === "tournament" && (
        <div className="ph-modal-backdrop">
          <div
            className={[
              "ph-modal",
              "registration-selection-modal",
              selectionModal === "tournament" ? "is-tournament-selector" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-tourney-title"
          >
            <div className="registration-selection-header">
              <span className="registration-selection-eyebrow">
                TEAM REGISTRATION
              </span>
              <h2 id="reg-tourney-title" className="registration-selection-title">Select Tournament</h2>
              <p className="registration-selection-subtitle">Choose where you want to register your team.</p>
            </div>
            
            <div className="registration-tournament-carousel">
              <div
                className="registration-tournament-track"
              >
                {tournaments.map((tournament) => {
                  const logoUrl =
                    tournament.logo_image_url ||
                    tournament.logo_url;

                  const normalizedStatus = String(
                    tournament.status || ""
                  )
                  .trim()
                  .toLowerCase();

                return (
                  <article
                    key={tournament.id}
                    className="registration-tournament-card"
                  >
                    <div className="registration-tournament-logo-stage">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`${tournament.name} logo`}
                          className="registration-tournament-logo"
                        />
                      ) : (
                        <div
                          className="registration-tournament-logo-fallback"
                          aria-hidden="true"
                        >
                          {getTournamentInitials(
                            tournament.name
                          )}
                        </div>
                      )}
                    </div>

                    <div className="registration-tournament-content">
                      <h3
                        className="registration-tournament-name"
                        title={tournament.name}
                      >
                        {tournament.name}
                      </h3>

                      <div className="registration-tournament-meta">
                        <span>
                          {tournament.game_type}
                        </span>

                        {tournament.season && (
                          <>
                            <span
                              className="registration-tournament-meta-dot"
                              aria-hidden="true"
                            >
                              •
                            </span>

                            <span>
                              {tournament.season}
                            </span>
                          </>
                        )}
                      </div>

                      <span
                        className={[
                          "registration-tournament-status",
                          `is-${normalizedStatus}`,
                        ].join(" ")}
                      >
                        {normalizedStatus.toUpperCase()}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="registration-tournament-select"
                      onClick={() =>
                        handleTournamentSelect(tournament)
                      }
                    >
                      Select Tournament
                    </button>
                  </article>
                );
              })}
            </div>

            </div>

            {tournaments.length > 1 && (
              <p className="registration-swipe-hint">
                Swipe to browse tournaments
              </p>
            )}

            <div className="registration-selection-footer">
              <button
                type="button"
                className="ph-btn ph-btn-secondary"
                onClick={() => navigate("/")}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {selectionModal === "mode" && selectedTournament && (
        <div className="ph-modal-backdrop">
          <div
            className={[
              "ph-modal",
              "registration-selection-modal",
              "is-mode-selector",
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-mode-title"
          >
            <div className="registration-selection-header">
              <span className="registration-selection-eyebrow">Select Division</span>
              <h2 id="reg-mode-title" className="registration-selection-title">{selectedTournament.name}</h2>
            </div>
            
            <div
              ref={modeTrackRef}
              className="registration-mode-card-grid"
              onScroll={handleModeTrackScroll}
            >
              {modes.map((mode) => {
                const tile = getModeTileContent(mode);

                const imageSrc = getModeCardImage(
                  selectedTournament?.game_type,
                  mode.code
                );

                const accessibleModeName =
                  mode.name ||
                  tile.caption ||
                  tile.heading ||
                  mode.code ||
                  "Tournament division";

                return (
                  <article
                    key={mode.id}
                    className="registration-mode-card"
                  >
                    <div className="registration-mode-card-media">
                      <span className="registration-mode-card-badge">
                        {getModeBadgeLabel(mode)}
                      </span>

                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={`${accessibleModeName} division`}
                          className="registration-mode-card-image"
                          loading="eager"
                        />
                      ) : (
                        <div className="registration-mode-card-fallback">
                          <span className="registration-mode-card-fallback-heading">
                            {tile.heading}
                          </span>

                          <span className="registration-mode-card-fallback-caption">
                            {truncateModeCaption(
                              tile.caption,
                              12
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="registration-mode-card-actions">
                      <button
                        type="button"
                        className="registration-mode-card-select"
                        onClick={() =>
                          applyModeSelection(mode)
                        }
                        aria-label={getModeSelectLabel(mode)}
                      >
                        {getModeSelectLabel(mode)}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {modes.length > 1 && (
              <>
                <p className="registration-swipe-hint">
                  Swipe to browse divisions
                </p>

                <div
                  className="registration-mode-dots"
                  aria-label="Division navigation"
                >
                  {modes.map((mode, index) => (
                    <button
                      key={mode.id}
                      type="button"
                      className={[
                        "registration-mode-dot",
                        index === activeModeIndex
                          ? "is-active"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() =>
                        scrollToModeCard(index)
                      }
                      aria-label={`View ${
                        mode.name || mode.code
                      }`}
                      aria-current={
                        index === activeModeIndex
                          ? "true"
                          : undefined
                      }
                    />
                  ))}
                </div>
              </>
            )}

            <div className="registration-selection-footer">
              {canChangeTournament && (
                <button className="ph-btn ph-btn-secondary" onClick={handleChangeSelection}>
                  Choose Another Tournament
                </button>
              )}
              <button className="ph-btn ph-btn-secondary" onClick={() => navigate("/")}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTournament &&
        modesLoading &&
        !selectionModal && (
          <div
            className="
              ph-card
              registration-loading-state
            "
            role="status"
            aria-live="polite"
          >
            <div
              className="
                registration-loading-spinner
              "
              aria-hidden="true"
            />

            <h3>Loading Divisions</h3>

            <p>
              Checking the available registration
              divisions for this tournament.
            </p>
          </div>
        )}

      {selectedTournament &&
        !modesLoading &&
        modesLoadError &&
        !selectionModal && (
          <div
            className="
              ph-card
              registration-load-error
            "
            role="alert"
          >
            <div
              className="
                registration-state-icon
              "
              aria-hidden="true"
            >
              !
            </div>

            <h3>Unable to Load Divisions</h3>

            <p>{modesLoadError}</p>

            <button
              type="button"
              className="ph-btn ph-btn-primary"
              onClick={() =>
                setModesReloadKey(
                  (current) => current + 1
                )
              }
            >
              Try Again
            </button>

            <button
              type="button"
              className="ph-btn ph-btn-secondary"
              onClick={() => navigate("/")}
            >
              Back to Home
            </button>
          </div>
        )}

      {noModesAvailable && !selectionModal && (
        <div className="registration-empty-state">
          <div style={{ fontSize: "32px", marginBottom: "1rem" }}>⚠️</div>
          <h3 style={{ color: "#f8fafc", marginBottom: "0.5rem" }}>Registration Unavailable</h3>
          <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>Registration is not available for any division in this tournament.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            {canChangeTournament && (
              <button className="ph-btn ph-btn-primary" onClick={handleChangeSelection}>
                Choose Another Tournament
              </button>
            )}
            <button className="ph-btn ph-btn-secondary" onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        </div>
      )}

      {showBlankStateFallback && (
        <div className="registration-empty-state">
          <h3 style={{ color: "#f8fafc", marginBottom: "0.5rem" }}>Complete Registration Selection</h3>
          <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>Choose a tournament and division to continue.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button className="ph-btn ph-btn-primary" onClick={reopenRequiredSelection}>
              Continue Selection
            </button>
            <button className="ph-btn ph-btn-secondary" onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        </div>
      )}

      {selectionComplete && (
        <div className="team-registration-card">
          <div className="registration-selection-summary">
            <div className="registration-selection-copy">
              <span className="registration-selection-eyebrow">
                Registering for
              </span>

              <strong className="registration-selection-title">
                {registrationTournamentLabel}
              </strong>

              <span className="registration-selection-meta">
                {selectedTournament?.game_type || "Tournament"}
                {" · "}
                {registrationModeLabel}
              </span>
            </div>

            {changeSelectionLabel && (
              <button
                type="button"
                className="registration-selection-change"
                onClick={handleChangeSelection}
              >
                Change
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div className="admin-error-message">{error}</div>}
            {success && <div className="admin-error-message" style={{ backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "rgba(34, 197, 94, 0.4)", color: "#bbf7d0" }}>{success}</div>}

            <div className="form-group">
              <label>Team Name *</label>
              <p className="form-helper-text">Enter your official team name.</p>
              <input
                type="text"
                name="team_name"
                value={form.team_name}
                onChange={handleChange}
                placeholder="e.g. Team Liquid"
              />
            </div>

            <div className="form-group">
              <label>Short Name / Tag *</label>
              <p className="form-helper-text">Example: CMO, JZI, TNC</p>
              <input
                type="text"
                name="shortname"
                value={form.shortname}
                onChange={handleChange}
                placeholder="e.g. TL"
              />
            </div>

            <div className="form-group">
              <label>Team Logo *</label>
              <p className="form-helper-text">Upload your team logo in PNG, JPG, or WebP format. Max 3MB.</p>
              
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                hidden
              />

              {!form.logo_url && (
                <div 
                  className={`custom-upload-card ${uploading ? "is-uploading" : ""}`}
                  onClick={triggerFileSelect}
                >
                  <svg className="custom-upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <div className="custom-upload-text">
                    {uploading ? (uploadStatus || "Uploading...") : "Choose Logo"}
                  </div>
                  {!uploading && <div className="custom-upload-subtext">Click to browse files</div>}
                </div>
              )}

              {form.logo_url && (
                <div className="upload-preview-container">
                  <img src={form.logo_url} alt="Logo preview" className="upload-logo-preview" />
                  <div className="upload-status">
                    <div className="upload-status-title">
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      Logo uploaded successfully
                    </div>
                    <div className="upload-status-filename">{uploadedFileName || "Team Logo"}</div>
                  </div>
                  <div className="upload-actions">
                    <button type="button" className="ph-btn ph-btn-secondary" style={{ padding: "8px 12px", minHeight: "36px", fontSize: "13px" }} onClick={triggerFileSelect}>
                      Change
                    </button>
                    <button type="button" className="ph-btn ph-btn-secondary" style={{ padding: "8px 12px", minHeight: "36px", fontSize: "13px", color: "#fca5a5", borderColor: "rgba(220, 38, 38, 0.3)" }} onClick={removeLogo}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
              
              {uploadError && <p style={{ color: "#fca5a5", fontSize: "13px", marginTop: "8px" }}>{uploadError}</p>}
            </div>

            <div className="form-group">
              <label>Captain Name *</label>
              <p className="form-helper-text">Person admins can contact for this team.</p>
              <input
                type="text"
                name="captain_name"
                value={form.captain_name}
                onChange={handleChange}
                placeholder="Captain's name"
              />
            </div>

            <div className="form-group">
              <label>Contact Number or Messenger Link *</label>
              <p className="form-helper-text">Use a phone number, Facebook profile, or Messenger link.</p>
              <input
                type="text"
                name="contact"
                value={form.contact}
                onChange={handleChange}
                placeholder="e.g. 09xx-xxx-xxxx or m.me/username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: "32px" }}>
              <label>Notes</label>
              <p className="form-helper-text">Add player list, remarks, or other details if needed.</p>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Any additional info about your team"
                rows={4}
              />
            </div>

            <button type="submit" className="ph-btn ph-btn-primary" style={{ width: "100%", fontSize: "16px", padding: "14px" }} disabled={loading || uploading}>
              {loading ? "Submitting..." : "Submit Team"}
            </button>
          </form>
        </div>
      )}

      {showSuccessModal && (
        <div className="submission-success-backdrop">
          <div className="submission-success-modal">
            <div className="submission-success-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="submission-success-title">Team Submitted Successfully!</h2>
            <p className="submission-success-message">
              Your team has been submitted
              {selectedTournament ? ` for ${selectedTournament.name}` : ""}
              {selectedMode ? ` — ${selectedMode.name || MODE_LABELS[selectedMode.code] || selectedMode.code}` : ""}.
              Please wait for admin approval.
            </p>
            <p style={{ color: "#64748b", fontSize: "13px" }}>Redirecting you back to the homepage...</p>
            
            <div className="submission-success-footer">
              <button 
                type="button" 
                className="ph-btn ph-btn-secondary" 
                onClick={() => navigate("/")}
                style={{ width: "100%" }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadTeam;
