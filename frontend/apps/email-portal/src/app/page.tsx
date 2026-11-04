import { Badge, Button, Card, CardBody, CardHeader } from "@promokote/ui";

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function EmailHome() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-email-light px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-email">
            Email
          </span>
          <h1 className="text-2xl font-semibold text-ink">Business Email Dashboard</h1>
        </div>
        <Button className="bg-email text-white hover:bg-email/90">
          <CheckCircleIcon /> Verify Domain
        </Button>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="py-4">
            <p className="text-sm font-medium text-slate">Emails Sent (30d)</p>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-semibold text-ink">0</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <p className="text-sm font-medium text-slate">Open Rate</p>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-semibold text-ink">--%</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <p className="text-sm font-medium text-slate">Bounce Rate</p>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-semibold text-ink">--%</p>
          </CardBody>
        </Card>
      </div>

      {/* Domain Setup Placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <h2 className="text-lg font-semibold text-ink">Sending Domains</h2>
          <Badge tone="email">DKIM / SPF</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="border-t border-mist px-6 py-12 text-center">
            <p className="text-sm text-slate">No domains connected yet.</p>
            <p className="mt-1 text-xs text-slate">Verify a domain to start sending transactional emails.</p>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
