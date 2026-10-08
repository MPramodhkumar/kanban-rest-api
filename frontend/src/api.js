// Change this if your backend runs somewhere else (or set VITE_API_URL in frontend/.env)
const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "tz-token";

export const auth = {
  getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  },
  onUnauthorized: null, // set by App: called when the server says "not logged in"
};

async function request(path, options = {}) {
  const token = auth.getToken();
  const headers = {
    ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(BASE + path, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail[0]?.msg ?? detail;
    } catch {}
    if (res.status === 401 && path !== "/auth/login") {
      auth.clear();
      auth.onUnauthorized?.();
    }
    const error = new Error(detail);
    error.status = res.status;
    throw error;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" }),
};

export const register = (name, email, password) => api.post("/auth/register", { name, email, password });

// The login route expects a form (username + password), not JSON. The username is the email.
export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: new URLSearchParams({ username: email, password }),
  });
  auth.setToken(data.access_token);
}
