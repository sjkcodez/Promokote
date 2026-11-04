import { ServiceCard, Badge } from "@promokote/ui";

const SmsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

export default function ConsoleHome() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Welcome to Promokote</h1>
          <p className="mt-1 text-sm text-slate">
            Choose a service to get started.
          </p>
        </div>
        <Badge tone="success">Wallet: 4,200 credits</Badge>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <ServiceCard
          tone="sms"
          title="Bulk SMS"
          description="Send promotional and transactional SMS at scale with delivery receipts and opt-out management."
          href="http://localhost:3002"
          icon={<SmsIcon />}
        />
        <ServiceCard
          tone="email"
          title="Business Email"
          description="Send transactional and campaign email from your own domain with SPF, DKIM and DMARC."
          href="http://localhost:3003"
          icon={<EmailIcon />}
        />
      </section>
    </main>
  );
}
