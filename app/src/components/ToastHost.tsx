import { useEffect, useState } from "react";

/** In-app toasts, used when there is no native `toast` plugin (a browser). */
export function ToastHost() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onToast = (event: Event) => {
      setText((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setText(null), 2600);
    };
    window.addEventListener("studio:toast", onToast);
    return () => {
      window.removeEventListener("studio:toast", onToast);
      window.clearTimeout(timer);
    };
  }, []);

  if (!text) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
      <div className="rounded-full border border-white/10 bg-[#13131f]/95 px-4 py-2 text-xs font-medium text-white/90 shadow-xl backdrop-blur">
        {text}
      </div>
    </div>
  );
}
