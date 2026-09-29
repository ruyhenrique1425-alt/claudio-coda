import type { Stats } from "@/lib/paciente-local";

/**
 * Radar dos cinco diagnósticos, desenhado em SVG. Cada eixo vai de 0 a 5,
 * que é o teto por atributo na ficha de admissão.
 */

const EIXOS = [
  { chave: "fatorCoringa", sigla: "CRG" },
  { chave: "imunidadeEtilica", sigla: "IMU" },
  { chave: "inimigoDoFim", sigla: "FIM" },
  { chave: "aptidaoAudio", sigla: "AUD" },
  { chave: "amnesia", sigla: "AMN" },
] as const;

const MAX = 5;
const R = 58;
const CENTRO = 80;

function ponto(indice: number, valor: number) {
  // Começa no topo e gira no sentido horário.
  const angulo = (Math.PI * 2 * indice) / EIXOS.length - Math.PI / 2;
  const raio = (valor / MAX) * R;
  return [CENTRO + Math.cos(angulo) * raio, CENTRO + Math.sin(angulo) * raio] as const;
}

export function RadarAtributos({ stats, className = "" }: { stats: Stats; className?: string }) {
  const area = EIXOS.map((e, i) => ponto(i, stats[e.chave]).join(",")).join(" ");
  const grades = [1, 2, 3, 4, 5];

  return (
    <svg
      viewBox="0 0 160 160"
      className={`h-40 w-40 ${className}`}
      role="img"
      aria-label="Radar dos cinco diagnósticos"
    >
      {grades.map((nivel) => (
        <polygon
          key={nivel}
          points={EIXOS.map((_, i) => ponto(i, nivel).join(",")).join(" ")}
          fill="none"
          stroke="var(--neon)"
          strokeOpacity={nivel === MAX ? 0.55 : 0.16}
          strokeWidth="1"
        />
      ))}

      {EIXOS.map((_, i) => {
        const [x, y] = ponto(i, MAX);
        return (
          <line
            key={i}
            x1={CENTRO}
            y1={CENTRO}
            x2={x}
            y2={y}
            stroke="var(--neon)"
            strokeOpacity="0.2"
          />
        );
      })}

      <polygon
        points={area}
        fill="color-mix(in oklab, var(--purple) 55%, transparent)"
        stroke="var(--neon)"
        strokeWidth="2"
      />

      {EIXOS.map((e, i) => {
        const [x, y] = ponto(i, MAX + 1.1);
        return (
          <text
            key={e.chave}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--whisky)"
            fontSize="9"
            fontFamily="var(--font-display)"
          >
            {e.sigla}
          </text>
        );
      })}

      {EIXOS.map((e, i) => {
        const [x, y] = ponto(i, stats[e.chave]);
        return <circle key={e.chave} cx={x} cy={y} r="2.5" fill="var(--neon)" />;
      })}
    </svg>
  );
}
