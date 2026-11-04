import { Badge, Button, Card, CardBody, CardHeader } from "@promokote/ui";

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5v14"/>
  </svg>
);

export default function SmsHome() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-sms-light px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-sms">
            SMS
          </span>
          <h1 className="text-2xl font-semibold text-ink">Bulk SMS Dashboard</h1>
        </div>
        <Button className="bg-sms text-white hover:bg-sms/90">
          <PlusIcon /> New Campaign
        </Button>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="py-4">
            <p className="text-sm font-medium text-slate">Sent Today</p>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-semibold text-ink">0</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <p className="text-sm font-medium text-slate">Delivered</p>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-semibold text-success">0</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <p className="text-sm font-medium text-slate">Failed</p>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-3xl font-semibold text-error">0</p>
          </CardBody>
        </Card>
      </div>

      {/* Recent Campaigns Table Placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <h2 className="text-lg font-semibold text-ink">Recent Campaigns</h2>
          <Badge tone="sms">Live API</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="border-t border-mist px-6 py-12 text-center">
            <p className="text-sm text-slate">You haven't sent any SMS campaigns yet.</p>
            <p className="mt-1 text-xs text-slate">Click "New Campaign" to get started.</p>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
