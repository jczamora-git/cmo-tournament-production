import { apiUrl } from "../config/api";

function getAdminToken() {
  return localStorage.getItem("admin_token") || "";
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };

  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const body =
    options.body === undefined
      ? undefined
      : isFormData || typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  const response = await fetch(apiUrl(`/api${path}`), {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    let message;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message || parsed?.error;
    } catch {
      message = null;
    }
    throw new Error(message || `Request failed: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The server returned an invalid JSON response (${response.status}).`);
  }
}

function adminRequest(path, options = {}) {
  const token = getAdminToken();
  const headers = { ...(options.headers || {}), "x-admin-token": token };
  return request(path, { ...options, headers });
}

// Build query string from params object
function qs(params) {
  if (!params) return "";
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// Public endpoints
export const getTeams = (params) => request(`/teams${qs(params)}`);
export const getMatches = () => request("/matches");
export const getUpcomingMatches = () => request("/matches/upcoming");
export const getMatchHistory = (params) => request(`/matches/history${qs(params)}`);
export const getMatchBracket = () => request("/matches/bracket");
export const getBrackets = () => request("/brackets");
export const getBracketPreview = (bracketId) =>
  request(`/brackets/${encodeURIComponent(bracketId)}/preview`);
export const getPublicLiveSettings = () => request("/live-settings");
export const getTournaments = (params) => request(`/tournaments${qs(params)}`);
export const getTournamentBySlug = (slug) => request(`/tournaments/${slug}`);
export const getTournamentModes = (tournamentId) => request(`/tournaments/${tournamentId}/modes`);
export const getVideos = () => request("/videos");
export const getTournamentVideos = (slug) => request(`/tournaments/${slug}/videos`);

// BR Group Standings (public read — Controller push is POST /api/sync/standings/br)
export const getBrGroupStandings = (params) => request(`/standings/br-group${qs(params)}`);

// Public team submission
export const submitTeam = (payload) =>
  request("/team-submissions", { method: "POST", body: payload });

// Admin auth
export const adminLogin = (token) =>
  request("/admin/login", { method: "POST", body: { token } });

export const adminVerify = () => adminRequest("/admin/verify");

// Admin teams
export const adminGetTeams = (params) => adminRequest(`/admin/teams${qs(params)}`);
export const adminCreateTeam = (payload) =>
  adminRequest("/admin/teams", { method: "POST", body: payload });
export const adminUpdateTeam = (id, payload) =>
  adminRequest(`/admin/teams/${id}`, { method: "PUT", body: payload });
export const adminDeleteTeam = (id) =>
  adminRequest(`/admin/teams/${id}`, { method: "DELETE" });
export const adminNormalizeTeamLogo = (id, payload) =>
  adminRequest(`/admin/teams/${id}/normalize-logo`, { method: "POST", body: payload });

// Admin matches
export const adminGetMatches = () => adminRequest("/admin/matches");
export const adminCreateMatch = (payload) =>
  adminRequest("/admin/matches", { method: "POST", body: payload });
export const adminUpdateMatch = (id, payload) =>
  adminRequest(`/admin/matches/${id}`, { method: "PUT", body: payload });
export const adminDeleteMatch = (id) =>
  adminRequest(`/admin/matches/${id}`, { method: "DELETE" });

// Admin team submissions
export const adminGetSubmissions = (params) => adminRequest(`/admin/team-submissions${qs(params)}`);
export const adminApproveSubmission = (id, edits) =>
  adminRequest(`/admin/team-submissions/${id}/approve`, { method: "PUT", body: edits || {} });
export const adminRejectSubmission = (id) =>
  adminRequest(`/admin/team-submissions/${id}/reject`, { method: "PUT" });

// Admin live settings
export const adminGetLiveSettings = () => adminRequest("/admin/live-settings");
export const adminUpdateLiveSettings = (payload) =>
  adminRequest("/admin/live-settings", { method: "PUT", body: payload });

// Admin tournaments
export const adminGetTournaments = () => adminRequest("/admin/tournaments", { cache: "no-store" });
export const adminCreateTournament = (payload) => adminRequest("/admin/tournaments", { method: "POST", body: payload });
export const adminUpdateTournament = (id, payload) => adminRequest(`/admin/tournaments/${id}`, { method: "PUT", body: payload });
export const adminDeleteTournament = (id) => adminRequest(`/admin/tournaments/${id}`, { method: "DELETE" });

// Admin videos
export const adminGetVideos = () => adminRequest("/admin/videos");
export const adminCreateVideo = (payload) => adminRequest("/admin/videos", { method: "POST", body: payload });
export const adminUpdateVideo = (id, payload) => adminRequest(`/admin/videos/${id}`, { method: "PUT", body: payload });
export const adminDeleteVideo = (id) => adminRequest(`/admin/videos/${id}`, { method: "DELETE" });

// Admin uploads
export const adminUploadTournamentImage = (file, type, tournamentId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  if (tournamentId) formData.append("tournament_id", tournamentId);
  return adminRequest("/admin/uploads/tournament-image", { method: "POST", body: formData });
};
