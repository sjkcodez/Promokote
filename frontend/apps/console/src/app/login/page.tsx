"use client";
import { Button } from "@promokote/ui";
import { saveSession } from "@promokote/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await api.POST("/api/core/auth/login", {
      body: { email, password },
    });
    setLoading(false);
    if (error || !data) {
      setError("Invalid credentials.");
      return;
    }
    saveSession(data.token, (data.user as any).orgId);
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-mist bg-surface p-6 shadow-card">
        <h1 className="text-xl font-semibold text-ink">Sign in to Promokote</h1>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-md border border-mist bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-md border border-mist bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
