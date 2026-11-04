export interface paths {
  "/api/core/auth/login": {
    post: {
      requestBody: { content: { "application/json": { email: string; password: string } } };
      responses: { 200: { content: { "application/json": { token: string; user: unknown } } } };
    };
  };
}
