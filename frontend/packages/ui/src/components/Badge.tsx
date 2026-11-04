import * as React from "react";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "sms" | "email";

const tones: Record<Tone, string> = {
  neutral: "bg-mist text-slate",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
  sms: "bg-sms/10 text-sms",
  email: "bg-email/10 text-email",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
