import { resolveNarrationLanguage } from "../dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "../dramaturgy/piece-schedule";
import { level as connectionsLevel } from "../levels/connections.level";
import { startLevel } from "../levels/level.runtime";
import { LEVEL_CATALOG } from "../levels/level-catalog";
import type { Run } from "../levels/run-contract";
/** Resolve browser inputs, start one Run and connect the operator UI. */
import { mountConductorPage } from "../ui/conductor/conductor.page";
import { requireElement } from "../ui/shared/dom";
import { loadDeploymentConfig } from "./deployment-config";

const M5_HOST_STORAGE_KEY = "bm-conductor-m5-host";
const container = document.querySelector(".conductor");
if (!(container instanceof HTMLElement))
  throw new Error("Missing conductor root: .conductor");
const lifetime = new AbortController();
let run: Run | undefined;
let pendingStart: Promise<Run> | undefined;
let unmountUi: (() => void) | undefined;
let unloading: Promise<void> | undefined;
window.addEventListener("pagehide", onPageHide);

try {
  const deployment = await loadDeploymentConfig();
  lifetime.signal.throwIfAborted();
  if (deployment.stationName)
    document.title = `${deployment.stationName} — Becoming Many`;
  const stageMount = requireElement(container, "#world-stage", HTMLElement);
  const canvas = requireElement(
    stageMount,
    ".experience-canvas",
    HTMLCanvasElement,
  );
  const request = new URLSearchParams(window.location.search);
  pendingStart = startLevel(
    { canvas, viewport: stageMount },
    {
      signal: lifetime.signal,
      kind: "show",
      preset: connectionsLevel,
      show: {
        schedule: PIECE_SCHEDULE,
        language: resolveNarrationLanguage(request.get("language")),
        states: LEVEL_CATALOG,
      },
    },
  );
  run = await pendingStart;
  lifetime.signal.throwIfAborted();
  const { show, m5 } = run;
  if (!show) throw new Error("The conductor requires a Show");
  window.show = show;
  const initialM5Host = deployment.m5Host ?? readStoredM5Host();
  if (initialM5Host) m5?.setHost(initialM5Host);
  unmountUi = mountConductorPage({
    container,
    schedule: PIECE_SCHEDULE,
    stationName: deployment.stationName,
    show,
    run,
    m5,
    xr: run.xr,
    initialM5Host,
    isM5HostLocked: deployment.m5Host !== undefined,
    onM5HostChange: (host) => {
      try {
        if (host) localStorage.setItem(M5_HOST_STORAGE_KEY, host);
        else localStorage.removeItem(M5_HOST_STORAGE_KEY);
      } catch {
        /* Storage denial only loses the remembered host. */
      }
      m5?.setHost(host);
    },
    reloadPage: () => window.location.reload(),
  });
} catch (error) {
  const wasCancelled =
    lifetime.signal.aborted && error === lifetime.signal.reason;
  try {
    await unload();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Conductor startup and cleanup failed",
    );
  }
  if (!wasCancelled) {
    requireElement(document, "[data-startup-error]", HTMLElement).hidden =
      false;
    throw error;
  }
}

function onPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  void unload().catch((error: unknown) =>
    console.error("Conductor cleanup failed", error),
  );
}

function unload(): Promise<void> {
  if (unloading) return unloading;
  window.removeEventListener("pagehide", onPageHide);
  lifetime.abort();
  if (window.show === run?.show) delete window.show;
  unmountUi?.();
  unloading = (async () => {
    const running = run ?? (await pendingStart?.catch(() => undefined));
    await running?.unload();
  })();
  return unloading;
}

function readStoredM5Host(): string {
  try {
    return (localStorage.getItem(M5_HOST_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}
