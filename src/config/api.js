const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const normalizedBaseUrl = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/, "");

const apiUrl = (path) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${cleanPath}`;
};

export { API_BASE_URL, normalizedBaseUrl, apiUrl };
