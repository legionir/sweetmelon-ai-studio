import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { applySafeArea } from "./native/bridge";
import { waitForBridge } from "./native/sdk";

// The status bar height is read at launch and again whenever the app comes back
// from another app, rotates or regains focus.
void waitForBridge().then((native) => {
  if (!native) return;
  const refresh = () => void applySafeArea();
  refresh();
  window.addEventListener("resize", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refresh();
      window.setTimeout(refresh, 400);
    }
  });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
