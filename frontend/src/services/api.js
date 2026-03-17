/**
 * API Service - Frontend -> Backend/AI Service
 *
 * Notes:
 * - Backend base URL comes from VITE_API_URL.
 * - If VITE_API_URL is not set, relative paths are used.
 * - Register payload sends `fullName` (backend contract).
 */

const rawBackendUrl = import.meta.env.VITE_API_URL?.trim();
const rawAiUrl = import.meta.env.VITE_AI_URL?.trim();

const BASE_URL = rawBackendUrl ? rawBackendUrl.replace(/\/+$/, "") : "";
const AI_URL = (rawAiUrl || "http://localhost:8000").replace(/\/+$/, "");

function buildBackendUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return BASE_URL ? `${BASE_URL}${normalizedPath}` : normalizedPath;
}

function buildAiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${AI_URL}${normalizedPath}`;
}

function getToken() {
  return localStorage.getItem("access_token");
}

function decodeTokenPayload(token) {
  try {
    const payloadPart = token?.split(".")?.[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function isAccessTokenValid(token) {
  if (!token) return false;

  const payload = decodeTokenPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now + 5;
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

function persistTokens(data) {
  const accessToken = data?.accessToken ?? data?.AccessToken;
  const refreshToken = data?.refreshToken ?? data?.RefreshToken;

  if (accessToken) {
    localStorage.setItem("access_token", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  }

  return { accessToken, refreshToken };
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(url, options = {}) {
  const { skipAuthRefresh = false, ...fetchOptions } = options;

  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  let res;
  try {
    res = await fetch(url, { ...fetchOptions, headers });
  } catch {
    throw new Error("Sunucuya baglanilamadi. Backend adresi ve portunu kontrol edin.");
  }

  if (res.status === 401 && !skipAuthRefresh) {
    const refreshed = await authApi.refresh();

    if (refreshed) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${getToken()}`,
      };

      try {
        return await fetch(url, { ...fetchOptions, headers: retryHeaders });
      } catch {
        throw new Error("Sunucuya baglanilamadi. Backend adresi ve portunu kontrol edin.");
      }
    }

    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/giris";
    }
    throw new Error("Oturum suresi doldu.");
  }

  return res;
}

async function json(url, options = {}) {
  const res = await request(url, options);
  const body = await safeJson(res);

  if (!res.ok) {
    throw new Error(body.message || body.title || `HTTP ${res.status}`);
  }

  return body;
}

export const authApi = {
  async login(email, password) {
    const data = await json(buildBackendUrl("/api/auth/login"), {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    persistTokens(data);
    return data;
  },

  async register(fullName, email, password) {
    return json(buildBackendUrl("/api/auth/register"), {
      method: "POST",
      body: JSON.stringify({ fullName, email, password }),
    });
  },

  async refresh() {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return false;

      const res = await request(buildBackendUrl("/api/auth/refresh"), {
        method: "POST",
        skipAuthRefresh: true,
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await safeJson(res);
      const { accessToken } = persistTokens(data);
      return !!accessToken;
    } catch {
      return false;
    }
  },

  logout() {
    clearTokens();
  },

  isLoggedIn() {
    const token = getToken();
    const valid = isAccessTokenValid(token);

    if (!valid && token) {
      clearTokens();
    }

    return valid;
  },
};

export const gazetteApi = {
  async getIssues({ page = 1, pageSize = 20, category = "" } = {}) {
    const params = new URLSearchParams({ page, pageSize });
    if (category) params.set("category", category);
    return json(buildBackendUrl(`/api/gazette/issues?${params}`));
  },

  async getIssue(id) {
    return json(buildBackendUrl(`/api/gazette/issues/${id}`));
  },

  async search(query, { page = 1, pageSize = 20 } = {}) {
    const params = new URLSearchParams({ q: query, page, pageSize });
    return json(buildBackendUrl(`/api/gazette/search?${params}`));
  },
};

export const adminApi = {
  async aiHealth() {
    const res = await fetch(buildAiUrl("/health"));
    return res.json();
  },

  async backendHealth() {
    const res = await fetch(buildBackendUrl("/health"));
    return res.json();
  },

  async scrape(date, saveToBackend = true) {
    const res = await fetch(buildAiUrl("/scrape"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, save_to_backend: saveToBackend }),
    });
    return res.json();
  },

  async scrapeToday(saveToBackend = true) {
    const res = await fetch(buildAiUrl(`/scrape/today?save_to_backend=${saveToBackend}`), {
      method: "POST",
    });
    return res.json();
  },

  async jobStatus(jobId) {
    const res = await fetch(buildAiUrl(`/scrape/status/${jobId}`));
    return res.json();
  },

  async listJobs() {
    const res = await fetch(buildAiUrl("/scrape/jobs"));
    return res.json();
  },

  async scrapeRaw(date, options = {}) {
    const payload = {
      date,
      max_docs: options.maxDocs ?? 0,
      include_main_pdf: options.includeMainPdf ?? false,
      keep_debug_images: options.keepDebugImages ?? false,
      allow_table_pages: options.allowTablePages ?? false,
      save_to_backend: options.saveToBackend ?? true,
      only_urls: options.onlyUrls ?? null,
      preview_limit: options.previewLimit ?? 20,
    };

    const res = await fetch(buildAiUrl("/scrape/raw"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getRawOutput(date, limit = 20) {
    const res = await fetch(buildAiUrl(`/scrape/raw/output/${date}?limit=${limit}`));
    return res.json();
  },
};
