import { apiUrl } from "../config/api";

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

export const getTeams = () => request("/teams");
export const createTeam = (payload) => request("/teams", { method: "POST", body: payload });
export const updateTeam = (id, payload) => request(`/teams/${id}`, { method: "PUT", body: payload });
export const deleteTeam = (id) => request(`/teams/${id}`, { method: "DELETE" });

export const getMatches = () => request("/matches");
export const getUpcomingMatches = () => request("/matches/upcoming");
export const getMatchHistory = () => request("/matches/history");
export const getMatchBracket = () => request("/matches/bracket");
