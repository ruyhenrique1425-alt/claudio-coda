import logoAsset from "@/assets/dispel-logo.png.asset.json";
import iconAsset from "@/assets/dispel-icon.png.asset.json";

export function DispelLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Dispel"
      className={`${className} object-contain`}
      draggable={false}
    />
  );
}

export function DispelIcon({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`${className} shrink-0 overflow-hidden rounded-xl bg-[#1B6E3A] ring-1 ring-white/10 shadow-sm`}
    >
      <img
        src={iconAsset.url}
        alt="Dispel"
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}
