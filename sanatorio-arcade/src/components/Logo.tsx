/**
 * A marca da casa.
 *
 * O brasão é o da própria república — arco "REPÚBLICA", o caminhante roxo com
 * a bengala, os ramos e a fita "SANATÓRIO". A versão escura tem o preto virado
 * em creme, senão a fita some na tela preta do app.
 */
export function Logo({ tamanho = "barra" }: { tamanho?: "barra" | "grande" }) {
  if (tamanho === "grande") {
    return (
      <div className="flex flex-col items-center">
        <img
          src="/marca/brasao-escuro.png"
          alt="Brasão da República Sanatório"
          width={220}
          height={178}
          className="w-[min(220px,62vw)]"
        />
        <p className="font-arcade mt-3 text-[8px] uppercase tracking-[0.3em] text-whisky">
          Mariana · MG · desde 2009
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <img
        src="/marca/brasao-96.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0"
        aria-hidden
      />
      <span className="flex min-w-0 flex-col justify-center">
        <span className="font-arcade truncate text-[8px] uppercase tracking-[0.28em] text-whisky">
          República
        </span>
        <span className="font-arcade truncate text-[15px] leading-none text-neon text-glow">
          SANATÓRIO
        </span>
      </span>
    </div>
  );
}
