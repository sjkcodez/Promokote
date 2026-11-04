import createClient from "openapi-fetch";
import type { paths } from "./schema";

export type ApiConfig = {
  baseUrl: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
};

export function createApi({ baseUrl, getToken, onUnauthorized }: ApiConfig) {
  const client = createClient<paths>({ baseUrl });

client.use({
  onRequest({ request }) {
    const token = getToken?.();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    request.headers.set("X-Promokote-Client", "web");
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401) onUnauthorized?.();
    return response;
  },
});

  return client;
}

export type ApiClient = ReturnType<typeof createApi>;
