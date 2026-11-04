import Link from "next/link";
import * as React from "react";

export function ServiceCard({
  tone,
  title,
  description,
  href,
  icon,
}: {
  tone: "sms" | "email";
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "sms"
      ? {
          bg: "bg-sms-light",
          text: "text-sms",
          border: "border-sms/20",
        }
      : {
          bg: "bg-email-light",
          text: "text-email",
          border: "border-email/20",
        };

  return (
    <Link
      href={href}
      className={`group block rounded-xl border border-mist bg-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-popover`}
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${toneClass.bg} ${toneClass.text}`}
      >
        {icon}
      </div>
      <h3 className="mb-1 text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm text-slate">{description}</p>
      <span className={`mt-4 inline-flex text-sm font-medium ${toneClass.text}`}>
        Open →
      </span>
    </Link>
  );
}
