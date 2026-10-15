import { useCallback, useEffect, useState } from "react";
import { Boxes, Mic, SlidersHorizontal } from "lucide-react";
import { StudioProvider } from "./state/Studio";
import { Talk } from "./screens/Talk";
import { Models } from "./screens/Models";
import { Settings } from "./screens/Settings";
import { ToastHost } from "./components/ToastHost";
import { interceptBackButton, minimizeApp } from "./native/bridge";
import { cn } from "./utils/cn";

type Tab = "talk" | "models" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "talk", label: "Talk", icon: Mic },
  { id: "models", label: "Models", icon: Boxes },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];

function Shell() {
  const [tab, setTab] = useState<Tab>("talk");

  // Android back: to the Talk screen, then out of the app (the models keep loaded).
  const onBack = useCallback(() => {
    if (tab !== "talk") setTab("talk");
    else void minimizeApp();
  }, [tab]);

  useEffect(() => {
    let off: (() => void) | undefined;
    void interceptBackButton(onBack).then((unsubscribe) => {
      off = unsubscribe;
    });
    return () => off?.();
  }, [onBack]);

  return (
    <div className="flex h-full flex-col bg-[#07070d] text-white antialiased">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400">
          <Mic className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-sm font-bold tracking-wide">Melon AI Studio</h1>
      </header>

      <main className="min-h-0 flex-1">
        {tab === "talk" && <Talk onOpenModels={() => setTab("models")} />}
        {tab === "models" && <Models />}
        {tab === "settings" && <Settings />}
      </main>

      <nav className="flex shrink-0 border-t border-white/5 bg-[#0a0a12] pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
              tab === id ? "text-fuchsia-300" : "text-white/40",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}
