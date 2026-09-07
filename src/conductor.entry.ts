/** Resolve browser inputs, start one Run and connect the operator UI. */
import { mountConductorPage } from "./conductor/conductor.page";
import "./conductor/conductor.css";
import { resolveNarrationLanguage } from "./dramaturgy/narration-catalog";
import { PIECE_SCHEDULE } from "./dramaturgy/piece-schedule";
import { SHOW_LEVEL_STATES } from "./dramaturgy/show-levels";
import { level as connectionsLevel } from "./levels/connections.level";
import { type Run, startLevel } from "./levels/level.runtime";
import { loadDeploymentConfig } from "./station/deployment-config";
import { FrameMetricsSampler } from "./test-ui/frame-metrics";

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
  const stageMount = document.createElement("div");
  const frameMetrics = new FrameMetricsSampler();
  const request = new URLSearchParams(window.location.search);
  pendingStart = startLevel(stageMount, {
    signal: lifetime.signal,
    kind: "show",
    preset: connectionsLevel,
    show: {
      schedule: PIECE_SCHEDULE,
      language: resolveNarrationLanguage(request.get("language")),
      states: SHOW_LEVEL_STATES,
    },
    onFrame: (deltaSeconds) => frameMetrics.add(deltaSeconds),
    m5ExpectedDeviceId: deployment.m5DeviceId,
  });
  run = await pendingStart;
  lifetime.signal.throwIfAborted();
  const { show, m5 } = run;
  if (!show) throw new Error("The conductor requires a Show");
  const initialM5Host = deployment.m5Host ?? readStoredM5Host();
  if (initialM5Host) m5?.setHost(initialM5Host);
  unmountUi = mountConductorPage({
    container,
    stageMount,
    schedule: PIECE_SCHEDULE,
    stationName: deployment.stationName,
    show,
    run,
    m5,
    xr: run.xr,
    frameMetrics,
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
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = "Unable to start Becoming Many. Please reload.";
    container.append(alert);
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
