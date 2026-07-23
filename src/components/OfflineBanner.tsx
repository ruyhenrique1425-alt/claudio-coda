import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div className="sticky top-0 z-[60] w-full bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-md">
      <WifiOff className="w-4 h-4" />
      Sem conexão — verifique sua internet. Alterações não serão salvas até reconectar.
    </div>
  );
}
