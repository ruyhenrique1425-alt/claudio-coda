import type { LucideIcon } from "lucide-react";

export function PlaceholderScreen({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-sm border-2 border-neon/40 bg-card/50 shadow-[0_0_24px_-8px_var(--neon)]">
        <Icon className="h-9 w-9 text-neon" />
      </div>
      <h1 className="font-arcade mt-6 text-sm uppercase text-neon text-glow">{title}</h1>
      <p className="mt-3 max-w-[16rem] text-sm text-muted-foreground">{description}</p>
      <p className="font-arcade mt-6 animate-pulse text-[8px] uppercase text-whisky">
        Módulo em quarentena
      </p>
    </section>
  );
}
