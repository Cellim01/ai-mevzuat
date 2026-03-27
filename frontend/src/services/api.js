const rawBase = import.meta.env.VITE_API_URL?.trim();
const BASE = rawBase ? rawBase.replace(/\/+$/, "") : "";

function url(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return BASE ? `${BASE}${p}` : p;
}

function getToken() { return localStorage.getItem("access_token"); }

function decodePayload(token) {
  try {
    const p = token?.split(".")?.[1];
    if (!p) return null;
    const b = p.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b + "=".repeat((4 - b.length % 4) % 4)));
  } catch { return null; }
}

function tokenOk(token) {
  const p = decodePayload(token);
  return !!(p?.exp > Math.floor(Date.now() / 1000) + 5);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

function persist(data) {
  const at = data?.accessToken ?? data?.AccessToken;
  const rt = data?.refreshToken ?? data?.RefreshToken;
  if (at) localStorage.setItem("access_token", at);
  if (rt) localStorage.setItem("refresh_token", rt);
  return { accessToken: at };
}

async function safeJson(res) {
  const t = await res.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return { message: t }; }
}

async function request(url, opts = {}) {
  const { skipAuthRefresh = false, ...rest } = opts;
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...rest.headers,
  };
  let res;
  try { res = await fetch(url, { ...rest, headers }); }
  catch { throw new Error("Sunucuya bağlanılamadı."); }

  if (res.status === 401 && !skipAuthRefresh) {
    const ok = await authApi.refresh();
    if (ok) {
      try { return await fetch(url, { ...rest, headers: { ...headers, Authorization: `Bearer ${getToken()}` } }); }
      catch { throw new Error("Sunucuya bağlanılamadı."); }
    }
    clearTokens();
    window.location.href = "/giris";
    throw new Error("Oturum süresi doldu.");
  }
  return res;
}

async function json(endpoint, opts = {}) {
  const res = await request(endpoint, opts);
  const body = await safeJson(res);
  if (!res.ok) throw new Error(body.message || body.title || `HTTP ${res.status}`);
  return body;
}

export const authApi = {
  async login(email, password) {
    const data = await json(url("/api/auth/login"), { method: "POST", body: JSON.stringify({ email, password }) });
    persist(data);
    return data;
  },
  async register(fullName, email, password) {
    return json(url("/api/auth/register"), { method: "POST", body: JSON.stringify({ fullName, email, password }) });
  },
  async refresh() {
    try {
      const rt = localStorage.getItem("refresh_token");
      if (!rt) return false;
      const res = await request(url("/api/auth/refresh"), { method: "POST", skipAuthRefresh: true, body: JSON.stringify({ refreshToken: rt }) });
      if (!res.ok) return false;
      return !!persist(await safeJson(res)).accessToken;
    } catch { return false; }
  },
  logout() { clearTokens(); },
  isLoggedIn() {
    const t = getToken();
    if (t && !tokenOk(t)) { clearTokens(); return false; }
    return tokenOk(t);
  },
};

export const gazetteApi = {
  async getDocuments({ page = 1, pageSize = 15, category = "", from = "", to = "", search = "" } = {}) {
    const p = new URLSearchParams({ page, pageSize });
    if (category) p.set("category", category);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (search) p.set("search", search);
    return json(url(`/api/gazette?${p}`));
  },
  async getDocument(id) { return json(url(`/api/gazette/${id}`)); },
  async getIssues({ page = 1, pageSize = 20 } = {}) {
    return json(url(`/api/gazette/issues?page=${page}&pageSize=${pageSize}`));
  },
};

export const legalApi = {
  async query(query, maxResults = 5) {
    return json(url("/api/legal/query"), { method: "POST", body: JSON.stringify({ query, maxResults }) });
  },
};

export const adminApi = {
  async backendHealth() { const r = await fetch(url("/health")); return r.json(); },
  async aiHealth() { return json(url("/api/admin/ai/health")); },
  async listJobs() { return json(url("/api/admin/jobs")); },
  async jobStatus(id) { return json(url(`/api/admin/jobs/${id}`)); },
  async scrapeRaw(date, o = {}) {
    return json(url("/api/admin/scrape/raw"), {
      method: "POST",
      body: JSON.stringify({
        date, maxDocs: o.maxDocs ?? 0, includeMainPdf: o.includeMainPdf ?? false,
        keepDebugImages: o.keepDebugImages ?? false, allowTablePages: o.allowTablePages ?? false,
        saveToBackend: o.saveToBackend ?? true, onlyUrls: o.onlyUrls ?? null, previewLimit: o.previewLimit ?? 20,
      }),
    });
  },
  async getRawOutput(date, limit = 20) { return json(url(`/api/admin/scrape/raw/output/${date}?limit=${limit}`)); },
  async clearLegalCache(q = "") {
    return json(url(`/api/admin/legal/cache${q ? `?query=${encodeURIComponent(q)}` : ""}`), { method: "DELETE" });
  },
  async legalQuery(query, maxResults = 5) {
    return json(url("/api/legal/query"), { method: "POST", body: JSON.stringify({ query, maxResults }) });
  },
};
