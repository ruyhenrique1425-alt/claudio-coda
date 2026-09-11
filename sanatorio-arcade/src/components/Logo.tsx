/**
 * Emblema alinhado verticalmente ao nome, integrado à base do texto.
 * Bloco único — sem elementos flutuantes ou soltos.
 */
export function Logo() {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <span className="shrink-0" aria-hidden>
        <svg width="26" height="30" viewBox="0 0 26 30" className="block">
          <g fill="none" stroke="var(--neon)" strokeWidth="2" strokeLinecap="square">
            <path
              d="M13 2 L23 8 V19 L13 28 L3 19 V8 Z"
              fill="color-mix(in oklab, var(--purple) 45%, transparent)"
            />
            <path d="M13 9 V21" />
            <path d="M8 13 H18" />
          </g>
        </svg>
      </span>
      <span className="flex min-w-0 flex-col justify-end">
        <span className="font-arcade truncate text-[13px] text-neon text-glow">SANATÓRIO</span>
        <span className="mt-1 h-px w-full bg-neon/60" />
        <span className="mt-1 truncate text-[9px] uppercase tracking-[0.28em] text-whisky">
          Ala de festas
        </span>
      </span>
    </div>
  );
}
