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
  return response.json();
}

function adminRequest(path, options = {}) {
  const token = getAdminToken();
  const headers = { ...(options.headers || {}), "x-admin-token": token };
  return request(path, { ...options, headers });
}

// Public endpoints
export const getTeams = () => request("/teams");
export const getMatches = () => request("/matches");
export const getUpcomingMatches = () => request("/matches/upcoming");
export const getMatchHistory = () => request("/matches/history");
export const getMatchBracket = () => request("/matches/bracket");
export const getPublicLiveSettings = () => request("/live-settings");

// Public team submission
export const submitTeam = (payload) =>
  request("/team-submissions", { method: "POST", body: payload });

// Admin auth
export const adminLogin = (token) =>
  request("/admin/login", { method: "POST", body: { token } });

export const adminVerify = () => adminRequest("/admin/verify");

// Admin teams
export const adminGetTeams = () => adminRequest("/admin/teams");
export const adminCreateTeam = (payload) =>
  adminRequest("/admin/teams", { method: "POST", body: payload });
export const adminUpdateTeam = (id, payload) =>
  adminRequest(`/admin/teams/${id}`, { method: "PUT", body: payload });
export const adminDeleteTeam = (id) =>
  adminRequest(`/admin/teams/${id}`, { method: "DELETE" });

// Admin matches
export const adminGetMatches = () => adminRequest("/admin/matches");
export const adminCreateMatch = (payload) =>
  adminRequest("/admin/matches", { method: "POST", body: payload });
export const adminUpdateMatch = (id, payload) =>
  adminRequest(`/admin/matches/${id}`, { method: "PUT", body: payload });
export const adminDeleteMatch = (id) =>
  adminRequest(`/admin/matches/${id}`, { method: "DELETE" });

// Admin team submissions
export const adminGetSubmissions = () => adminRequest("/admin/team-submissions");
export const adminApproveSubmission = (id, edits) =>
  adminRequest(`/admin/team-submissions/${id}/approve`, { method: "PUT", body: edits || {} });
export const adminRejectSubmission = (id) =>
  adminRequest(`/admin/team-submissions/${id}/reject`, { method: "PUT" });

// Admin live settings
export const adminGetLiveSettings = () => adminRequest("/admin/live-settings");
export const adminUpdateLiveSettings = (payload) =>
  adminRequest("/admin/live-settings", { method: "PUT", body: payload });
