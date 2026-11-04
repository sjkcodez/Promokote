const TOKEN_KEY = "promokote.token";
const ORG_KEY = "promokote.org";

export function saveSession(token: string, orgId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ORG_KEY, orgId);
}

export function readSession() {
  if (typeof window === "undefined") return { token: null, orgId: null };
  return {
    token: localStorage.getItem(TOKEN_KEY),
    orgId: localStorage.getItem(ORG_KEY),
  };
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function isAuthenticated() {
  return Boolean(readSession().token);
}
