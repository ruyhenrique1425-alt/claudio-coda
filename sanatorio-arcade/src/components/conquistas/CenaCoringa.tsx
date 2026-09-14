import type { ReactElement } from "react";
import { motion } from "motion/react";

import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import type { CodigoConquista } from "@/lib/conquistas";

/**
 * As cenas do Coringa, uma por QR code.
 *
 * Tudo desenhado com blocos e animado por transformação: mantém o ar de
 * fliperama, não baixa imagem nenhuma (o que importa no sítio) e continua
 * rodando com o app offline.
 */

const CORINGA = {
  personagem: "coringa",
  avatar: {
    cabelo: "verde",
    roupa: "roxo",
    acessorio: "mascara",
    expressao: "caotico",
    item: "nenhum",
  },
};

/** O Coringa com o item que a cena pede. */
function Ator({ item = "nenhum", className = "" }: { item?: string; className?: string }) {
  return (
    <div className={className}>
      <PixelAvatar
        personagem={CORINGA.personagem}
        avatar={{ ...CORINGA.avatar, item }}
        size="md"
        glow
        title="O Coringa de plantão"
      />
    </div>
  );
}

/* ------------------------------- boas-vindas ------------------------------ */
function CenaBemVindo() {
  // Cartas caindo do alto: a chegada ao hospício.
  const cartas = [0, 1, 2, 3, 4, 5];
  return (
    <>
      {cartas.map((i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ y: -40, rotate: 0, opacity: 0 }}
          animate={{ y: 190, rotate: 380, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.32, ease: "linear" }}
          className="absolute top-0 h-6 w-4 rounded-[1px] border border-foreground bg-background"
          style={{ left: `${8 + i * 16}%` }}
        />
      ))}

      {/* Portões que abrem */}
      <motion.span
        aria-hidden
        animate={{ scaleX: [1, 0.15, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.45, 1] }}
        className="absolute inset-y-4 left-2 w-3 origin-left bg-[repeating-linear-gradient(to_bottom,var(--neon)_0_4px,transparent_4px_10px)]"
      />
      <motion.span
        aria-hidden
        animate={{ scaleX: [1, 0.15, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.45, 1] }}
        className="absolute inset-y-4 right-2 w-3 origin-right bg-[repeating-linear-gradient(to_bottom,var(--neon)_0_4px,transparent_4px_10px)]"
      />

      <motion.div
        animate={{ y: [0, -8, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <Ator />
      </motion.div>
    </>
  );
}

/* ----------------------------------- van ---------------------------------- */
function CenaVan() {
  const postes = [0, 1, 2, 3];
  return (
    <>
      {postes.map((i) => (
        <motion.span
          key={i}
          aria-hidden
          animate={{ x: [220, -40] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.37, ease: "linear" }}
          className="absolute top-6 h-10 w-1.5 bg-neon/40"
        />
      ))}
      <span aria-hidden className="absolute inset-x-0 bottom-10 h-0.5 bg-neon/30" />

      <motion.div
        animate={{ y: [0, -3, 0, 2, 0], rotate: [-1.2, 1.2, -1.2] }}
        transition={{ duration: 0.55, repeat: Infinity }}
        className="relative"
      >
        <div className="rounded-sm border-4 border-whisky bg-background px-3 pb-3 pt-2">
          <Ator />
        </div>
        <motion.span
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-3 left-3 grid h-6 w-6 place-items-center rounded-full border-2 border-foreground"
        >
          <span className="h-3 w-0.5 bg-foreground" />
        </motion.span>
        <motion.span
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-3 right-3 grid h-6 w-6 place-items-center rounded-full border-2 border-foreground"
        >
          <span className="h-3 w-0.5 bg-foreground" />
        </motion.span>
      </motion.div>
    </>
  );
}

/* ----------------------------------- bar ---------------------------------- */
function CenaBar() {
  const bolhas = [0, 1, 2, 3, 4];
  return (
    <>
      {bolhas.map((i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: -70, opacity: [0, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
          className="absolute bottom-12 h-2 w-2 rounded-full bg-whisky/70"
          style={{ right: `${18 + i * 7}%` }}
        />
      ))}

      <motion.div
        animate={{ rotate: [0, -22, -22, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.3, 0.7, 1] }}
        className="origin-bottom"
      >
        <Ator item="cerveja" />
      </motion.div>

      <motion.span
        aria-hidden
        animate={{ scaleY: [0.2, 1, 0.2] }}
        transition={{ duration: 2.6, repeat: Infinity }}
        className="absolute bottom-8 right-8 h-4 w-8 origin-bottom rounded-t-sm bg-foreground/80"
      />
    </>
  );
}

/* ------------------------------- xeque-mate ------------------------------- */
function CenaXeque() {
  return (
    <>
      <span
        aria-hidden
        className="absolute bottom-6 h-10 w-36 rounded-sm border-2 border-foreground"
        style={{
          backgroundImage: "repeating-conic-gradient(var(--foreground) 0 25%, transparent 0 50%)",
          backgroundSize: "16px 16px",
        }}
      />

      <motion.span
        aria-hidden
        animate={{ rotate: [0, 0, 88], y: [0, 0, 6] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.55, 0.75] }}
        className="absolute bottom-[42px] right-[26%] h-7 w-4 origin-bottom rounded-t-full bg-destructive"
      />

      <motion.span
        aria-hidden
        animate={{ opacity: [0, 0, 1, 1, 0], y: [-4, -4, -12, -12, -4] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.6, 0.7, 0.9, 1] }}
        className="font-arcade absolute top-2 text-[12px] text-whisky"
      >
        ♛
      </motion.span>

      <motion.div
        animate={{ rotate: [-2, 2, -2], scale: [1, 1.05, 1] }}
        transition={{ duration: 2.8, repeat: Infinity }}
      >
        <Ator />
      </motion.div>
    </>
  );
}

/* --------------------------------- privada -------------------------------- */
function CenaPrivada() {
  return (
    <>
      <motion.span
        aria-hidden
        animate={{ scaleX: [1, 0.08, 0.08, 1] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.18, 0.82, 1] }}
        className="absolute inset-y-2 left-3 w-8 origin-left rounded-sm border-2 border-neon/70 bg-background"
      />

      <motion.span
        aria-hidden
        animate={{ scaleY: [0.2, 1, 0.2] }}
        transition={{ duration: 3.2, repeat: Infinity }}
        className="absolute right-6 top-6 h-16 w-4 origin-top rounded-sm bg-foreground/80"
      />

      <motion.div
        animate={{ y: [0, 2, 0] }}
        transition={{ duration: 0.9, repeat: Infinity }}
        className="relative"
      >
        <Ator />
        <span
          aria-hidden
          className="absolute -bottom-4 left-1/2 h-5 w-14 -translate-x-1/2 rounded-t-full border-2 border-foreground bg-background"
        />
      </motion.div>

      <motion.span
        aria-hidden
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="font-arcade absolute bottom-2 text-[7px] uppercase text-muted-foreground"
      >
        ocupado
      </motion.span>
    </>
  );
}

const CENAS: Record<CodigoConquista, () => ReactElement> = {
  bemvindo: CenaBemVindo,
  van: CenaVan,
  bar: CenaBar,
  xeque: CenaXeque,
  privada: CenaPrivada,
};

export function CenaCoringa({ codigo }: { codigo: CodigoConquista }) {
  const Cena = CENAS[codigo];

  return (
    <div className="relative grid h-52 w-full place-items-center overflow-hidden rounded-sm border-2 border-purple bg-black">
      <div aria-hidden className="crt-grid absolute inset-0 opacity-30" />
      <Cena />
    </div>
  );
}
