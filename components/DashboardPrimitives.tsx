import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

interface StatItem {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
}

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  backHref?: string;
  backLabel?: string;
  icon?: ReactNode;
  stats?: StatItem[];
  actions?: ReactNode;
}

interface StatusStripItem {
  label: string;
  value: ReactNode;
}

interface StatusStripProps {
  items: StatusStripItem[];
  columnsClassName?: string;
}

interface SectionCardProps {
  children: ReactNode;
  className?: string;
}

interface PanelProps {
  children: ReactNode;
  className?: string;
}

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
}

interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

interface ControlBarProps {
  children: ReactNode;
  className?: string;
}

interface SurfaceNoticeProps {
  tone?: "success" | "error" | "warning" | "info";
  children: ReactNode;
  className?: string;
}

interface EmptyStateProps {
  icon: ReactNode;
  eyebrow: string;
  description: ReactNode;
  className?: string;
}

const NOTICE_TONE_CLASSES: Record<NonNullable<SurfaceNoticeProps["tone"]>, string> = {
  success: "border-green-200 bg-green-50 text-green-700",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref = "/",
  backLabel = "Back to dashboard",
  icon,
  stats,
  actions,
}: PageHeaderProps) {
  return (
    <section className="shell-panel shell-hero-grid rounded-[2rem] p-6 md:p-8 overflow-hidden relative">
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr] items-start">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <span>←</span>
            <span>{backLabel}</span>
          </Link>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
          <div className="mt-3 flex items-start gap-3">
            {icon ? <div className="text-3xl leading-none pt-1">{icon}</div> : null}
            <div>
              <h1 className="text-3xl md:text-4xl text-white" style={{ fontFamily: "var(--font-display)" }}>
                {title}
              </h1>
              <p className="text-slate-400 mt-3 max-w-2xl leading-relaxed">{description}</p>
            </div>
          </div>
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-3">
            {stats.map((item) => (
              <div key={item.label} className="shell-stat-card rounded-3xl px-4 py-4">
                <p className="font-mono text-[11px] text-slate-500 uppercase tracking-[0.18em]">{item.label}</p>
                <p className="text-lg text-white mt-2 leading-snug capitalize">{item.value}</p>
                {item.meta ? <p className="text-xs text-slate-400 mt-1">{item.meta}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StatusStrip({ items, columnsClassName }: StatusStripProps) {
  return (
    <section className={clsx("shell-status-strip rounded-[1.5rem] p-4 md:p-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4", columnsClassName)}>
      {items.map((item) => (
        <div key={item.label} className="shell-status-pill rounded-2xl px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
          <p className="text-sm text-white mt-2">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

export function PageContainer({
  children,
  className,
  maxWidthClassName = "max-w-7xl",
}: PageContainerProps) {
  return (
    <div className={clsx("p-5 md:p-8 w-full mx-auto flex-1", maxWidthClassName, className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={clsx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent mb-1.5">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg md:text-xl text-white leading-snug">{title}</h2>
        {description ? <p className="text-sm text-slate-400 mt-1.5">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className }: PanelProps) {
  return <section className={clsx("shell-panel rounded-[2rem] p-6", className)}>{children}</section>;
}

export function SectionCard({ children, className }: SectionCardProps) {
  return <Panel className={className}>{children}</Panel>;
}

export function ControlBar({ children, className }: ControlBarProps) {
  return (
    <div className={clsx("shell-panel-soft rounded-2xl p-4 border border-border/80", className)}>
      {children}
    </div>
  );
}

export function SurfaceNotice({ tone = "info", children, className }: SurfaceNoticeProps) {
  return (
    <div className={clsx("rounded-2xl border px-4 py-3 text-sm", NOTICE_TONE_CLASSES[tone], className)}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, eyebrow, description, className }: EmptyStateProps) {
  return (
    <div className={clsx("shell-panel-soft rounded-[2rem] px-8 py-10 max-w-lg mx-auto text-center", className)}>
      <div className="mb-4 opacity-30 flex justify-center text-5xl [&>svg]:w-12 [&>svg]:h-12">{icon}</div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">{eyebrow}</p>
      <p className="text-slate-400 text-sm max-w-xs mx-auto">{description}</p>
    </div>
  );
}
