import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Check, ChevronDown, Code2, CreditCard, FlaskConical, Mail, MailCheck, MessageSquare, ShieldCheck, Upload, UserPlus, Users, Zap } from 'lucide-react'
import PublicShell from '../components/PublicShell'
import { usePlanText } from '../components/PlanCards'
import { fmtMoney, useQuery } from '../lib/api'
import { TKey, useI18n } from '../lib/i18n'
import type { ActivationConfig, Plan } from '../lib/types'

function Section({ id, eyebrow, title, intro, children, tone = 'canvas' }: { id?: string; eyebrow: string; title: string; intro?: string; children: ReactNode; tone?: 'canvas' | 'surface' }) {
  return (
    <section id={id} className={`scroll-mt-16 border-t border-line ${tone === 'surface' ? 'bg-surface' : ''}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-sm font-bold uppercase tracking-wider text-accent">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-3 max-w-2xl text-muted">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

/** Illustrative phone showing a demo SMS, built in CSS so it follows the theme. */
function PhoneMock() {
  const { t } = useI18n()
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2.2rem] border-[10px] border-ink bg-surface p-4 shadow-2xl ring-1 ring-line">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-line" />
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-on-brand">PK</div>
        <div><p className="text-sm font-semibold">{t('land.phone.sender')}</p><p className="text-xs text-muted">SMS</p></div>
      </div>
      <div className="space-y-3 py-4 text-sm">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-subtle px-3 py-2">{t('land.phone.msg1')}</div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-subtle px-3 py-2">{t('land.phone.msg2')}</div>
        <div className="ml-auto max-w-[70%] rounded-2xl rounded-tr-sm bg-brand-500 px-3 py-2 text-on-brand">{t('land.phone.reply')}</div>
      </div>
      <div className="rounded-xl border border-accent-line bg-accent-soft px-3 py-2 text-xs text-accent-ink">{t('land.phone.note')}</div>
    </div>
  )
}

function Steps({ items }: { items: { icon: typeof Mail; title: string; text: string }[] }) {
  return (
    <ol className="space-y-5">
      {items.map((s, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-on-brand">{i + 1}</div>
          <div className="min-w-0 pt-1">
            <p className="flex items-center gap-2 font-semibold"><s.icon className="h-4 w-4 text-accent" />{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function Landing() {
  const { t } = useI18n()
  const text = usePlanText()
  const { data } = useQuery<{ plans: Plan[]; smsActivationConfig: ActivationConfig }>(`{
    plans { id name description price currency periodDays smsQuota emailQuota rateLimitPerMinute maxApiKeys }
    smsActivationConfig { senderIdFee currency processingDays demoCredits demoSenderName }
  }`)
  const cfg = data?.smsActivationConfig
  const demoN = cfg?.demoCredits ?? 10
  const plans = (data?.plans ?? []).slice(0, 4)
  const fee = cfg && cfg.senderIdFee > 0 ? fmtMoney(cfg.senderIdFee, cfg.currency) : null

  const services = [
    { icon: MessageSquare, title: t('land.svc.sms.title'), text: t('land.svc.sms.text'), points: ['land.svc.sms.p1', 'land.svc.sms.p2', 'land.svc.sms.p3'] as TKey[] },
    { icon: Mail, title: t('land.svc.email.title'), text: t('land.svc.email.text'), points: ['land.svc.email.p1', 'land.svc.email.p2', 'land.svc.email.p3'] as TKey[] },
    { icon: Code2, title: t('land.svc.api.title'), text: t('land.svc.api.text'), points: ['land.svc.api.p1', 'land.svc.api.p2', 'land.svc.api.p3'] as TKey[] },
  ]
  const faqs: [TKey, TKey][] = [
    ['land.faq.q1', 'land.faq.a1'], ['land.faq.q2', 'land.faq.a2'], ['land.faq.q3', 'land.faq.a3'],
    ['land.faq.q4', 'land.faq.a4'], ['land.faq.q5', 'land.faq.a5'], ['land.faq.q6', 'land.faq.a6'],
  ]

  return (
    <PublicShell>
      {/* A. Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-500/15 blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
              <FlaskConical className="h-3.5 w-3.5" />{t('land.hero.badge', { n: demoN })}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {t('land.hero.title1')} <span className="text-accent">{t('land.hero.title2')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('land.hero.text')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="btn-primary !px-6 !py-3 text-base">{t('land.hero.cta', { n: demoN })}<ArrowRight className="h-5 w-5" /></Link>
              <Link to="/login" className="btn-secondary !px-6 !py-3 text-base">{t('auth.signIn')}</Link>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-muted sm:grid-cols-3">
              {(['land.hero.chip1', 'land.hero.chip2', 'land.hero.chip3'] as TKey[]).map((k) => <li key={k} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-accent" />{t(k)}</li>)}
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      {/* B. Services */}
      <Section id="services" eyebrow={t('land.nav.services')} title={t('land.svc.title')} intro={t('land.svc.intro')} tone="surface">
        <div className="grid gap-5 md:grid-cols-3">
          {services.map((s) => (
            <div key={s.title} className="card flex flex-col bg-canvas">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><s.icon className="h-6 w-6" /></div>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.text}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {s.points.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t(p)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* C. How it works */}
      <Section id="how" eyebrow={t('land.nav.how')} title={t('land.how.title')} intro={t('land.how.intro')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold"><MessageSquare className="h-5 w-5 text-accent" />{t('land.svc.sms.title')}</h3>
            <Steps items={[
              { icon: Upload, title: t('land.how.sms1.t'), text: t('land.how.sms1.d') },
              { icon: MessageSquare, title: t('land.how.sms2.t'), text: t('land.how.sms2.d') },
              { icon: Zap, title: t('land.how.sms3.t'), text: t('land.how.sms3.d') },
              { icon: BadgeCheck, title: t('land.how.sms4.t'), text: t('land.how.sms4.d') },
            ]} />
          </div>
          <div className="card">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold"><Mail className="h-5 w-5 text-accent" />{t('land.svc.email.title')}</h3>
            <Steps items={[
              { icon: Users, title: t('land.how.em1.t'), text: t('land.how.em1.d') },
              { icon: Mail, title: t('land.how.em2.t'), text: t('land.how.em2.d') },
              { icon: Zap, title: t('land.how.em3.t'), text: t('land.how.em3.d') },
              { icon: ShieldCheck, title: t('land.how.em4.t'), text: t('land.how.em4.d') },
            ]} />
          </div>
        </div>
      </Section>

      {/* D. Getting started */}
      <Section id="start" eyebrow={t('land.nav.start')} title={t('land.start.title')} intro={t('land.start.intro')} tone="surface">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: UserPlus, title: t('land.start.s1.t'), text: t('land.start.s1.d') },
            { icon: MailCheck, title: t('land.start.s2.t'), text: t('land.start.s2.d') },
            { icon: FlaskConical, title: t('land.start.s3.t', { n: demoN }), text: t('land.start.s3.d', { name: cfg?.demoSenderName ?? 'PROMOKOTE' }) },
            { icon: BadgeCheck, title: t('land.start.s4.t'), text: fee ? t('land.start.s4.dFee', { fee, days: cfg!.processingDays }) : t('land.start.s4.d', { days: cfg?.processingDays ?? 7 }) },
            { icon: CreditCard, title: t('land.start.s5.t'), text: t('land.start.s5.d') },
          ].map((s, i) => (
            <div key={i} className="card relative bg-canvas">
              <span className="absolute right-4 top-4 text-3xl font-black text-line-strong" aria-hidden>{i + 1}</span>
              <s.icon className="h-6 w-6 text-accent" />
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-accent-line bg-accent-soft p-5 text-sm text-accent-ink">
          <p className="font-semibold">{t('land.start.senderTitle')}</p>
          <p className="mt-1">{t('land.start.senderText')}</p>
        </div>
      </Section>

      {/* E. Pricing */}
      <Section id="pricing" eyebrow={t('land.nav.pricing')} title={t('land.price.title')} intro={t('land.price.intro')}>
        {plans.length > 0 && (
          <div className={`grid gap-4 sm:grid-cols-2 ${plans.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {plans.map((p) => (
              <div key={p.id} className="card flex flex-col">
                <p className="font-bold">{p.name}</p>
                <p className="mt-2 text-2xl font-extrabold">{text.price(p)}<span className="text-xs font-medium text-muted"> {t('plans.perDays', { n: p.periodDays })}</span></p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">{text.features(p).slice(0, 2).map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-accent" />{f}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/pricing" className="btn-primary">{t('land.price.cta')}<ArrowRight className="h-4 w-4" /></Link>
          <Link to="/register" className="btn-secondary">{t('land.hero.cta', { n: demoN })}</Link>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" eyebrow={t('land.nav.faq')} title={t('land.faq.title')} tone="surface">
        <div className="grid gap-3 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <details key={q} className="group card bg-canvas !p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-semibold [&::-webkit-details-marker]:hidden">
                {t(q)}<ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-sm text-muted">{t(a, { n: demoN, name: cfg?.demoSenderName ?? 'PROMOKOTE' })}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* F. Call to action */}
      <section className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">{t('land.cta.title')}</h2>
            <p className="mt-2 max-w-xl text-zinc-400">{t('land.cta.text', { n: demoN })}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="btn-primary !px-6 !py-3">{t('auth.createAccount')}<ArrowRight className="h-4 w-4" /></Link>
            <Link to="/login" className="btn !border !border-white/20 !px-6 !py-3 text-white hover:bg-white/10">{t('auth.signIn')}</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
