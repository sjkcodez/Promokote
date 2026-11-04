"use client";
import { createApi } from "@promokote/api-client";
import { readSession, clearSession } from "@promokote/auth";

export const api = createApi({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  getToken: () => readSession().token,
  onUnauthorized: () => {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      clearSession();
      window.location.href = "/login";
    }
  },
});
