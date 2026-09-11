/**
 * Emblema da República Sanatório: o símbolo fica alinhado na vertical com o
 * nome e encostado na base do texto. Um bloco só, sem nada flutuando.
 */
export function Logo() {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <span className="shrink-0" aria-hidden>
        <svg width="30" height="34" viewBox="0 0 30 34" className="block">
          {/* Escudo da casa */}
          <path
            d="M15 2 L27 9 V21 L15 32 L3 21 V9 Z"
            fill="color-mix(in oklab, var(--purple) 50%, transparent)"
            stroke="var(--neon)"
            strokeWidth="2"
            strokeLinejoin="miter"
          />
          {/* Cruz do hospício, em amarelo de rótulo */}
          <g fill="var(--whisky)">
            <rect x="13" y="10" width="4" height="14" />
            <rect x="8" y="15" width="14" height="4" />
          </g>
        </svg>
      </span>
      <span className="flex min-w-0 flex-col justify-end">
        <span className="font-arcade truncate text-[8px] uppercase tracking-[0.3em] text-whisky">
          República
        </span>
        <span className="font-arcade truncate text-[15px] leading-none text-neon text-glow">
          SANATÓRIO
        </span>
        <span className="mt-1 h-px w-full bg-neon/60" />
      </span>
    </div>
  );
}
