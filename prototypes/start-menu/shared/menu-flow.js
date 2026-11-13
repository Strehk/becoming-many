/**
 * Purpose: Run the shared start-menu behaviour behind every prototype.
 * Context: Every variant needs the same working flow so they can be compared on
 *   look and feel alone: loading, continue, menu, settings, credits, the choice
 *   of desktop, VR or phone, and a launch hand-off.
 * Responsibility: Screen state, simulated loading, persisted settings, language,
 *   VR and motion-sensor detection, sound feedback, keyboard navigation, the
 *   generated settings / modes / credits blocks, and the variant switcher.
 * Boundary: Variants own their markup, styling and particles; they listen to the
 *   events emitted here and may delay an action with `beforeAction`.
 */

import { createInput } from "./input.js";
import { createMenuSound } from "./menu-sound.js";
import { VARIANTS } from "./variants.js";

// 1. Audience-facing copy. German is the default language of the installation.
const COPY = {
  de: {
    menu: "Menü",
    lede: "Eine immersive Reise durch nicht-menschliche Wahrnehmung",
    hintBegin:
      "Danach wählst du, wie du eintrittst: Desktop, VR-Brille oder Handy.",
    hintSettings: "Sprache, Ton, Grafik und Steuerung.",
    hintCredits: "Wer Becoming Many gemacht hat.",
    continueGate: "Enter drücken oder klicken, um fortzufahren",
    begin: "Beginnen",
    settings: "Einstellungen",
    credits: "Credits",
    back: "Zurück",
    loading: "Lädt",
    continue: "Klicken, um fortzufahren",
    continueTouch: "Tippen, um fortzufahren",
    hold: "Gedrückt halten, um zu beginnen",
    // Loading as if reality still had to be put together (07-09).
    building: [
      "Luft wird angerührt",
      "Bäume werden gepflanzt",
      "Tiere werden freigelassen",
      "Text wird geübt",
      "Geschichte wird ausgedacht",
      "Gerüche werden verteilt",
      "Echos werden ausprobiert",
      "Norden wird festgelegt",
      "Wärme wird ausgelegt",
      "Pilzfäden werden verknüpft",
      "Wind wird gestimmt",
      "Fledermäuse werden geweckt",
      "Wurzeln werden verlegt",
      "Himmel wird geweißt",
      "Boden wird angewärmt",
      "Partikel werden gezählt",
    ],
    // The senses in the order the show introduces them.
    stages: [
      {
        sense: "Luft",
        line: "Die weiße Welt bekommt Gewicht. Noch ist nichts zu sehen als sie.",
      },
      {
        sense: "Geruch",
        line: "Pflanzen verströmen ihre Signaturen, jede Familie riecht anders.",
      },
      {
        sense: "Echoortung",
        line: "Rufe gehen hinaus. Was zurückkommt, ist Entfernung.",
      },
      {
        sense: "Bewegungssinn",
        line: "Was sich bewegt, hinterlässt eine Spur. Was still steht, verschwindet.",
      },
      {
        sense: "Thermische Wahrnehmung",
        line: "Wärme scheint durch die kalte Welt: Körper, Steine, Wasser.",
      },
      {
        sense: "Magnetfeld",
        line: "Der Himmel bekommt eine Richtung. Norden wird spürbar.",
      },
      {
        sense: "Verbindungen",
        line: "Unter dem Boden knüpft sich ein Netz aus Wurzeln und Pilzfäden.",
      },
    ],
    stageDone: { sense: "Becoming Many", line: "" },
    enter: "Klicken, um einzutreten",
    enterTouch: "Tippen, um einzutreten",
    modes: "Wie möchtest du eintreten?",
    desktop: "Desktop",
    desktopHint: "Maus und Tastatur",
    vr: "VR-Brille",
    vrHint: "WebXR-Headset",
    gyro: "Handy",
    gyroHint: "Neigen statt Maus: der Bewegungssensor steuert",
    statusReady: "Bereit",
    statusChecking: "Wird geprüft …",
    statusMissing: "Nicht erkannt",
    statusPermission: "Erlaubnis nötig",
    statusPhoneOnly: "Nur auf dem Handy",
    language: "Sprache",
    volume: "Lautstärke",
    subtitles: "Untertitel",
    quality: "Grafik",
    low: "Niedrig",
    mid: "Mittel",
    high: "Hoch",
    invert: "Blick umkehren",
    reducedMotion: "Weniger Bewegung",
    on: "An",
    off: "Aus",
    creditsRole: "A Project By",
    launchDesktop:
      "Bewege die Maus, um dich umzusehen. Mit W A S D fliegst du.",
    launchVr: "Setz die Brille auf und tritt in die weiße Welt.",
    launchVrMissing:
      "Kein VR-Headset gefunden. Öffne diese Seite im Browser deiner Brille.",
    launchGyro:
      "Halte das Handy vor dich und neige es. Die Partikel folgen dir.",
    launchGyroDenied:
      "Der Zugriff auf den Bewegungssensor wurde nicht erlaubt.",
    launchGyroMissing:
      "Dieses Gerät meldet keinen Bewegungssensor. Öffne die Seite auf dem Handy.",
    launchNote: "Prototyp: Hier würde das Erlebnis starten.",
    backToMenu: "Zurück zum Menü",
  },
  en: {
    menu: "Menu",
    lede: "An Immersive Journey Through Non-Human Perception",
    hintBegin: "Then choose how to enter: desktop, VR headset or phone.",
    hintSettings: "Language, sound, graphics and controls.",
    hintCredits: "Who made Becoming Many.",
    continueGate: "Press Enter or click to continue",
    begin: "Begin",
    settings: "Settings",
    credits: "Credits",
    back: "Back",
    loading: "Loading",
    continue: "Click to continue",
    continueTouch: "Tap to continue",
    hold: "Press and hold to begin",
    building: [
      "Stirring the air",
      "Planting the trees",
      "Releasing the animals",
      "Rehearsing the lines",
      "Making up the story",
      "Spreading the scents",
      "Testing the echoes",
      "Deciding where north is",
      "Laying out the warmth",
      "Knotting the fungal threads",
      "Tuning the wind",
      "Waking the bats",
      "Laying the roots",
      "Whitewashing the sky",
      "Warming the ground",
      "Counting the particles",
    ],
    stages: [
      {
        sense: "Air",
        line: "The white world gains weight. Nothing to see yet but the air.",
      },
      {
        sense: "Scent",
        line: "Plants give off their signatures; every family smells different.",
      },
      {
        sense: "Echolocation",
        line: "Calls go out. What comes back is distance.",
      },
      {
        sense: "Motion",
        line: "What moves leaves a trace. What stands still disappears.",
      },
      {
        sense: "Thermal perception",
        line: "Warmth shines through the cold world: bodies, stones, water.",
      },
      {
        sense: "Magnetic field",
        line: "The sky takes on a direction. North becomes something felt.",
      },
      {
        sense: "Connections",
        line: "Under the ground a web of roots and fungal threads is knotted.",
      },
    ],
    stageDone: { sense: "Becoming Many", line: "" },
    enter: "Click to enter",
    enterTouch: "Tap to enter",
    modes: "How would you like to enter?",
    desktop: "Desktop",
    desktopHint: "Mouse and keyboard",
    vr: "VR headset",
    vrHint: "WebXR headset",
    gyro: "Phone",
    gyroHint: "Tilt instead of mouse: the motion sensor steers",
    statusReady: "Ready",
    statusChecking: "Checking …",
    statusMissing: "Not detected",
    statusPermission: "Needs permission",
    statusPhoneOnly: "Phone only",
    language: "Language",
    volume: "Volume",
    subtitles: "Subtitles",
    quality: "Graphics",
    low: "Low",
    mid: "Medium",
    high: "High",
    invert: "Invert look",
    reducedMotion: "Reduce motion",
    on: "On",
    off: "Off",
    creditsRole: "A Project By",
    launchDesktop: "Move the mouse to look around. Fly with W A S D.",
    launchVr: "Put on the headset and step into the white world.",
    launchVrMissing:
      "No VR headset found. Open this page in your headset's browser.",
    launchGyro:
      "Hold the phone in front of you and tilt it. The particles follow you.",
    launchGyroDenied: "Access to the motion sensor was not granted.",
    launchGyroMissing:
      "This device reports no motion sensor. Open the page on a phone.",
    launchNote: "Prototype: the experience would start here.",
    backToMenu: "Back to menu",
  },
};

/** The closing credits exactly as the piece authors them. */
const CREDITS = ["Erasmus Schmidt", "Tade Strehk", "Eddie Huesmann"];

const STORAGE_KEY = "becoming-many-menu-settings";
const DEFAULT_SETTINGS = {
  language: "de",
  volume: 70,
  subtitles: true,
  quality: "high",
  invert: false,
  reducedMotion: false,
};
const QUALITY_SCALE = { low: 0.4, mid: 0.7, high: 1 };

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private windows may refuse storage; settings then last for this visit.
  }
}

// 2. Small DOM builders for the generated blocks
function element(tag, className, attributes = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, value);
  return node;
}

const ICONS = {
  desktop: ["M4 5h16v11H4z", "M9 20h6", "M12 16v4"],
  vr: [
    "M3 8.5C3 7.7 3.7 7 4.5 7h15c.8 0 1.5.7 1.5 1.5V15c0 .8-.7 1.5-1.5 1.5h-4l-2-2.5h-3l-2 2.5h-4C3.7 16.5 3 15.8 3 15z",
  ],
  gyro: [
    "M8 3h8v18H8z",
    "M11 18h2",
    "M4 9a9 9 0 0 0 0 6",
    "M20 9a9 9 0 0 1 0 6",
  ],
};

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("bm-icon");
  for (const d of ICONS[name]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function buildSettings(slot) {
  const list = element("div", "bm-settings");
  const segmented = (key, options) => {
    const row = element("div", "bm-setting", { "data-setting-row": key });
    const label = element("span", "bm-setting__label", { "data-i18n": key });
    const group = element("div", "bm-seg", { role: "group" });
    for (const [value, copyKey, literal] of options) {
      const button = element("button", "bm-seg__option", {
        type: "button",
        "data-setting": key,
        "data-value": value,
      });
      if (literal) button.textContent = literal;
      else button.setAttribute("data-i18n", copyKey);
      group.append(button);
    }
    row.append(label, group);
    return row;
  };
  const toggle = (key) => {
    const row = element("div", "bm-setting", { "data-setting-row": key });
    const label = element("span", "bm-setting__label", { "data-i18n": key });
    const button = element("button", "bm-switch", {
      type: "button",
      role: "switch",
      "data-setting": key,
    });
    const knob = element("span", "bm-switch__knob");
    const text = element("span", "bm-switch__text");
    button.append(knob, text);
    row.append(label, button);
    return row;
  };
  const range = (key) => {
    const row = element("div", "bm-setting", { "data-setting-row": key });
    const label = element("label", "bm-setting__label", {
      "data-i18n": key,
      for: `bm-${key}`,
    });
    const wrap = element("div", "bm-range");
    const input = element("input", "bm-range__input", {
      id: `bm-${key}`,
      type: "range",
      min: "0",
      max: "100",
      step: "5",
      "data-setting": key,
    });
    const output = element("output", "bm-range__value", {
      "data-setting-output": key,
    });
    wrap.append(input, output);
    row.append(label, wrap);
    return row;
  };
  list.append(
    segmented("language", [
      ["de", null, "DE"],
      ["en", null, "EN"],
    ]),
    range("volume"),
    toggle("subtitles"),
    segmented("quality", [
      ["low", "low"],
      ["mid", "mid"],
      ["high", "high"],
    ]),
    toggle("invert"),
    toggle("reducedMotion"),
  );
  slot.replaceChildren(list);
}

function buildModes(slot) {
  const list = element("div", "bm-modes");
  for (const mode of ["desktop", "vr", "gyro"]) {
    const button = element("button", "bm-mode", {
      type: "button",
      "data-action": "mode",
      "data-mode": mode,
    });
    const iconWrap = element("span", "bm-mode__icon");
    iconWrap.append(icon(mode));
    const label = element("span", "bm-mode__label", { "data-i18n": mode });
    const hint = element("span", "bm-mode__hint", {
      "data-i18n": `${mode}Hint`,
    });
    const status = element("span", "bm-mode__status", {
      "data-mode-status": mode,
    });
    button.append(iconWrap, label, hint, status);
    list.append(button);
  }
  slot.replaceChildren(list);
}

function buildCredits(slot) {
  const list = element("div", "bm-credits");
  const title = element("p", "bm-credit bm-credit--title");
  title.textContent = "BECOMING MANY";
  const role = element("p", "bm-credit bm-credit--role", {
    "data-i18n": "creditsRole",
  });
  list.append(title, role);
  for (const name of CREDITS) {
    const line = element("p", "bm-credit bm-credit--name");
    line.textContent = name;
    list.append(line);
  }
  slot.replaceChildren(list);
}

function buildChrome(slug) {
  const index = VARIANTS.findIndex((variant) => variant.slug === slug);
  if (index < 0) return;
  const count = VARIANTS.length;
  const previous = VARIANTS[(index - 1 + count) % count];
  const next = VARIANTS[(index + 1) % count];
  const nav = element("nav", "bm-chrome", {
    "aria-label": "Prototype switcher",
  });
  const home = element("a", "bm-chrome__link", {
    href: "../",
    title: "All variants",
  });
  home.textContent = "▦";
  const back = element("a", "bm-chrome__link", {
    href: `../${previous.slug}/`,
    title: previous.name,
  });
  back.textContent = "‹";
  const label = element("span", "bm-chrome__label");
  label.textContent = `${String(index + 1).padStart(2, "0")}/${count} ${VARIANTS[index].name}`;
  const forward = element("a", "bm-chrome__link", {
    href: `../${next.slug}/`,
    title: next.name,
  });
  forward.textContent = "›";
  const restart = element("button", "bm-chrome__link", {
    type: "button",
    title: "Restart (R)",
  });
  restart.textContent = "↻";
  restart.addEventListener("click", () => window.location.reload());
  nav.append(home, back, label, forward, restart);
  document.body.append(nav);
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "[") window.location.href = `../${previous.slug}/`;
    if (event.key === "]") window.location.href = `../${next.slug}/`;
    if (event.key === "r" || event.key === "R") window.location.reload();
    if (event.key === "h" || event.key === "H") nav.hidden = !nav.hidden;
  });
}

// 4. Simulated loading with natural stalls
function loadingCurve(seconds) {
  const keys = [[0, 0]];
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const steps = 9;
  for (let i = 1; i < steps; i += 1) {
    keys.push([
      (i / steps) * seconds * (0.85 + random() * 0.3),
      i / steps + (random() - 0.5) * 0.06,
    ]);
  }
  keys.push([seconds, 1]);
  keys.sort((a, b) => a[0] - b[0]);
  return (time) => {
    if (time >= seconds) return 1;
    for (let i = 1; i < keys.length; i += 1) {
      const [t1, v1] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (time <= t1) {
        const local = (time - t0) / Math.max(t1 - t0, 0.001);
        const eased = local < 0.35 ? 0 : (local - 0.35) / 0.65;
        return Math.max(
          0,
          Math.min(1, v0 + (v1 - v0) * eased * eased * (3 - 2 * eased)),
        );
      }
    }
    return 1;
  };
}

// 5. The flow
/**
 * options.slug: the variant folder name (for the switcher).
 * options.loadSeconds: how long the simulated load takes (?load= overrides).
 * options.paceSeconds: the shown percentage never runs faster than 0-100 % in
 *   this time, so a quick load still reads as a gesture, not a flash.
 * options.buildingSeconds: when set, [data-building-line] cycles through the
 *   "building" lines at this interval while loading, as if reality were
 *   still being put together; no percentage needed.
 * options.stageHoldSeconds: a sense stays named at least this long; unlike
 *   minStageSeconds it never holds the percentage back, so a quick load
 *   simply names fewer senses.
 * options.beforeReady(): optional async hook awaited when loading reaches
 *   100 %, before the continue gesture is offered (the title forming).
 * options.beforeAction(action, mode): optional async hook awaited before a
 *   screen change, so a variant can play its own transition first.
 */
export function createMenuFlow(options = {}) {
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const listeners = {};
  const settings = readSettings();
  const input = createInput();
  input.invert = settings.invert;
  const sound = createMenuSound(() => settings.volume);
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  // ?load=<seconds> simulates a faster or slower connection.
  const loadSeconds =
    Number(params.get("load")) || (options.loadSeconds ?? 6.5);
  const curve = loadingCurve(loadSeconds);

  const flow = {
    screen: "",
    progress: 0,
    ready: false,
    hovered: null,
    settings,
    input,
    sound,
    stage: 0,
    skipped: params.has("skip"),
    availability: { desktop: "ready", vr: "checking", gyro: "checking" },
    launch: { mode: null, status: null },
    get quality() {
      return QUALITY_SCALE[settings.quality] ?? 1;
    },
    get motion() {
      return settings.reducedMotion ? 0.3 : 1;
    },
    t(key) {
      return COPY[settings.language]?.[key] ?? COPY.de[key] ?? key;
    },
    on(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return flow;
    },
    go,
    /** Centre of the visible control for an action or mode key, in CSS pixels. */
    anchor(key) {
      const scope = `[data-screen~="${flow.screen}"]`;
      const node = document.querySelector(
        `${scope} [data-mode="${key}"], ${scope} [data-action="${key}"]`,
      );
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rect,
      };
    },
  };

  const emit = (event, ...args) => {
    for (const handler of listeners[event] ?? []) handler(...args);
  };

  // 5a. Language and generated blocks
  for (const slot of document.querySelectorAll("[data-settings-slot]"))
    buildSettings(slot);
  for (const slot of document.querySelectorAll("[data-modes-slot]"))
    buildModes(slot);
  for (const slot of document.querySelectorAll("[data-credits-slot]"))
    buildCredits(slot);
  if (!params.has("bare")) buildChrome(options.slug);

  function applyLanguage() {
    root.lang = settings.language;
    for (const node of document.querySelectorAll("[data-i18n]")) {
      const value = flow.t(node.dataset.i18n);
      if (typeof value === "string") node.textContent = value;
    }
    for (const node of document.querySelectorAll("[data-i18n-gate]")) {
      node.textContent = flow.t(
        coarsePointer ? "continueTouch" : "continueGate",
      );
    }
    renderHint();
    for (const node of document.querySelectorAll("[data-i18n-continue]")) {
      node.textContent = flow.t(coarsePointer ? "continueTouch" : "continue");
    }
    for (const node of document.querySelectorAll("[data-i18n-enter]")) {
      node.textContent = flow.t(coarsePointer ? "enterTouch" : "enter");
    }
    renderStage();
    renderAvailability();
    renderLaunch();
  }

  function renderSettings() {
    for (const control of document.querySelectorAll("[data-setting]")) {
      const key = control.dataset.setting;
      const value = settings[key];
      if (control.classList.contains("bm-seg__option")) {
        control.setAttribute(
          "aria-pressed",
          String(control.dataset.value === value),
        );
      } else if (control.getAttribute("role") === "switch") {
        control.setAttribute("aria-checked", String(Boolean(value)));
        const text = control.querySelector(".bm-switch__text");
        if (text) text.textContent = flow.t(value ? "on" : "off");
      } else if (control instanceof HTMLInputElement) {
        control.value = String(value);
        control.style.setProperty("--value", `${value}%`);
      }
    }
    for (const output of document.querySelectorAll("[data-setting-output]")) {
      output.textContent = String(settings[output.dataset.settingOutput]);
    }
    root.dataset.quality = settings.quality;
    root.dataset.reducedMotion = String(settings.reducedMotion);
  }

  function updateSetting(key, value) {
    settings[key] = value;
    input.invert = settings.invert;
    writeSettings(settings);
    renderSettings();
    if (key === "language") applyLanguage();
    if (key === "volume") sound.setVolume(value);
    emit("settings", settings, key);
  }

  document.addEventListener("click", (event) => {
    const control =
      event.target instanceof Element
        ? event.target.closest("[data-setting]")
        : null;
    if (!control || control instanceof HTMLInputElement) return;
    const key = control.dataset.setting;
    if (control.dataset.value !== undefined)
      updateSetting(key, control.dataset.value);
    else updateSetting(key, !settings[key]);
    sound.hover("setting");
  });
  document.addEventListener("input", (event) => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement) || !control.dataset.setting)
      return;
    updateSetting(control.dataset.setting, Number(control.value));
  });
  document.addEventListener("change", (event) => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.setting
    )
      sound.hover("setting");
  });

  // 5b. Availability of the three ways in
  const gyroNeedsPermission =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function";
  const gyroPossible =
    typeof DeviceOrientationEvent !== "undefined" &&
    navigator.maxTouchPoints > 0;
  flow.availability.gyro = !gyroPossible
    ? "phoneOnly"
    : gyroNeedsPermission
      ? "permission"
      : "ready";

  if (navigator.xr?.isSessionSupported) {
    navigator.xr
      .isSessionSupported("immersive-vr")
      .then((supported) => {
        flow.availability.vr = supported ? "ready" : "missing";
      })
      .catch(() => {
        flow.availability.vr = "missing";
      })
      .finally(() => {
        renderAvailability();
        emit("availability", flow.availability);
      });
  } else {
    flow.availability.vr = "missing";
  }

  function renderAvailability() {
    const copyKey = {
      ready: "statusReady",
      checking: "statusChecking",
      missing: "statusMissing",
      permission: "statusPermission",
      phoneOnly: "statusPhoneOnly",
    };
    for (const node of document.querySelectorAll("[data-mode-status]")) {
      const status = flow.availability[node.dataset.modeStatus];
      node.textContent = flow.t(copyKey[status]);
      node.dataset.status = status;
      node
        .closest("[data-mode]")
        ?.setAttribute("data-available", String(status === "ready"));
    }
  }

  // 5c. Screens
  function go(screen) {
    if (screen === flow.screen) return;
    const previous = flow.screen;
    flow.screen = screen;
    root.dataset.screen = screen;
    for (const node of document.querySelectorAll("[data-screen]")) {
      const active = node.dataset.screen.split(" ").includes(screen);
      node.classList.toggle("is-active", active);
      node.inert = !active;
      node.setAttribute("aria-hidden", String(!active));
    }
    setHover(null);
    emit("screen", screen, previous);
    const focusTarget = document.querySelector(
      `[data-screen~="${screen}"] [data-autofocus], [data-screen~="${screen}"] [data-action]`,
    );
    if (focusTarget instanceof HTMLElement && !coarsePointer) {
      window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 60);
    }
  }

  function setHover(key) {
    if (flow.hovered === key) return;
    flow.hovered = key;
    root.dataset.hovered = key ?? "";
    renderHint();
    if (key) sound.hover(key);
    emit("hover", key);
  }

  /** The old menu's note line: the pointed entry explains itself. */
  function renderHint() {
    const hintKey = {
      start: "hintBegin",
      settings: "hintSettings",
      credits: "hintCredits",
      desktop: "desktopHint",
      vr: "vrHint",
      gyro: "gyroHint",
    }[flow.hovered];
    for (const node of document.querySelectorAll("[data-hint]")) {
      node.textContent = hintKey ? flow.t(hintKey) : "";
    }
  }

  // 5d. Launch
  function launch(mode, permission) {
    flow.launch = { mode, status: "pending" };
    renderLaunch();
    const settle = (status) => {
      flow.launch = { mode, status };
      renderLaunch();
      emit("launch", mode, status);
    };
    if (mode === "desktop") settle("ready");
    else if (mode === "vr")
      settle(flow.availability.vr === "ready" ? "ready" : "missing");
    else if (permission) {
      permission
        .then((answer) => settle(answer === "granted" ? "ready" : "denied"))
        .catch(() => settle("denied"));
    } else settle(flow.availability.gyro === "ready" ? "ready" : "missing");
  }

  function renderLaunch() {
    const { mode, status } = flow.launch;
    root.dataset.launchMode = mode ?? "";
    root.dataset.launchStatus = status ?? "";
    if (!mode) return;
    const textKey = {
      desktop: { ready: "launchDesktop" },
      vr: { ready: "launchVr", missing: "launchVrMissing" },
      gyro: {
        ready: "launchGyro",
        missing: "launchGyroMissing",
        denied: "launchGyroDenied",
      },
    }[mode][status];
    for (const node of document.querySelectorAll("[data-launch-title]"))
      node.textContent = flow.t(mode);
    for (const node of document.querySelectorAll("[data-launch-text]")) {
      node.textContent = textKey ? flow.t(textKey) : "";
    }
    for (const node of document.querySelectorAll("[data-launch-note]")) {
      node.textContent = flow.t("launchNote");
    }
  }

  function renderGyroReadout() {
    const nodes = document.querySelectorAll("[data-gyro-readout]");
    if (nodes.length > 0 && flow.launch.mode === "gyro") {
      const { alpha, beta, gamma } = input.orientation;
      const text = input.gyroActive
        ? `α ${alpha.toFixed(0)}°  β ${beta.toFixed(0)}°  γ ${gamma.toFixed(0)}°`
        : "α –  β –  γ –";
      for (const node of nodes) node.textContent = text;
    }
    window.setTimeout(renderGyroReadout, 120);
  }
  renderGyroReadout();

  // 5e. Actions
  async function perform(action, mode) {
    sound.unlock();
    // A motion-permission prompt must be requested inside the gesture itself.
    let permission;
    if (action === "mode" && mode === "gyro" && gyroNeedsPermission) {
      permission = DeviceOrientationEvent.requestPermission();
    }
    sound.select(mode ?? action);
    emit("select", action, mode);
    if (options.beforeAction) await options.beforeAction(action, mode);
    if (action === "start") go("modes");
    else if (action === "settings") go("settings");
    else if (action === "credits") go("credits");
    else if (action === "back" || action === "menu") go("menu");
    else if (action === "mode") {
      launch(mode, permission);
      go("launch");
    }
  }

  function actionKey(node) {
    return node.dataset.mode ?? node.dataset.action;
  }

  document.addEventListener("click", (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest("[data-action]")
        : null;
    if (!node || node.closest("[inert]")) return;
    if (performance.now() < ignoreClicksUntil) return;
    if (node.dataset.hold && event.detail !== 0) return; // pointer holds trigger themselves
    perform(node.dataset.action, node.dataset.mode);
  });

  // Press-and-hold actions: --hold runs 0..1 on the element while pressed.
  document.addEventListener("pointerdown", (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest("[data-hold]")
        : null;
    if (!(node instanceof HTMLElement) || node.closest("[inert]")) return;
    sound.unlock();
    const duration = Number(node.dataset.hold) || 1200;
    const started = performance.now();
    let frame = 0;
    const release = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--hold", "0");
      emit("hold", 0);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
    const step = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      node.style.setProperty("--hold", String(progress));
      emit("hold", progress);
      if (progress >= 1) {
        release();
        perform(node.dataset.action, node.dataset.mode);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    frame = requestAnimationFrame(step);
  });

  const hoverFrom = (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest("[data-action]")
        : null;
    if (node && !node.closest("[inert]")) setHover(actionKey(node));
  };
  document.addEventListener("pointerover", hoverFrom);
  document.addEventListener("focusin", hoverFrom);
  document.addEventListener("pointerout", (event) => {
    const node =
      event.target instanceof Element
        ? event.target.closest("[data-action]")
        : null;
    const into =
      event.relatedTarget instanceof Element
        ? event.relatedTarget.closest("[data-action]")
        : null;
    if (node && node !== into && document.activeElement !== node)
      setHover(null);
  });
  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!(active instanceof Element) || !active.closest("[data-action]"))
        setHover(null);
    }, 0);
  });

  // Continue after loading, and keyboard navigation everywhere else.
  let ignoreClicksUntil = 0;
  const continueAfterLoad = () => {
    if (flow.screen !== "loading" || !flow.ready) return;
    // The click that ends this press must not land on a freshly shown button.
    ignoreClicksUntil = performance.now() + 450;
    sound.unlock();
    // The context may need a moment after the gesture before it sounds.
    const welcome = () => {
      if (!sound.ready) {
        window.setTimeout(welcome, 60);
        return;
      }
      sound.wind(true);
      sound.arrive();
    };
    welcome();
    go("menu");
  };
  window.addEventListener("pointerdown", (event) => {
    sound.unlock();
    if (event.target instanceof Element && event.target.closest(".bm-chrome"))
      return;
    continueAfterLoad();
  });
  window.addEventListener("keydown", (event) => {
    sound.unlock();
    if (flow.screen === "loading") {
      if (!["[", "]", "r", "R", "h", "H"].includes(event.key))
        continueAfterLoad();
      return;
    }
    if (event.key === "Escape") {
      if (flow.screen === "launch") go("modes");
      else if (flow.screen !== "menu") go("menu");
      return;
    }
    const arrows = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"];
    if (!arrows.includes(event.key) || event.target instanceof HTMLInputElement)
      return;
    const focusables = [
      ...document.querySelectorAll(
        `[data-screen~="${flow.screen}"] [data-action], [data-screen~="${flow.screen}"] [data-setting]`,
      ),
    ].filter(
      (node) => node instanceof HTMLElement && node.offsetParent !== null,
    );
    if (focusables.length === 0) return;
    event.preventDefault();
    const current = focusables.indexOf(document.activeElement);
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const next =
      current < 0
        ? 0
        : (current + (forward ? 1 : -1) + focusables.length) %
          focusables.length;
    focusables[next].focus();
  });

  // 5f. Loading
  // A sense stays named for at least minStageSeconds, so a jump in the
  // loading never skips one; the shown percentage waits for it.
  const minStageMs = (options.minStageSeconds ?? 0) * 1000;
  const holdMs = (options.stageHoldSeconds ?? 0) * 1000;
  const paceSeconds = options.paceSeconds ?? 0;
  const stageCount = COPY.de.stages.length;
  let shownIndex = 0;
  let shownAt = performance.now();
  let rawProgress = 0;
  function advanceStage() {
    if (holdMs) {
      const real = Math.min(
        Math.floor(flow.progress * stageCount),
        stageCount - 1,
      );
      const now = performance.now();
      if (real > shownIndex && now - shownAt >= holdMs) {
        shownIndex += 1;
        shownAt = now;
      }
      return;
    }
    const real = Math.min(Math.floor(rawProgress * stageCount), stageCount - 1);
    if (!minStageMs) {
      shownIndex = real;
      return;
    }
    const now = performance.now();
    if (real > shownIndex && now - shownAt >= minStageMs) {
      shownIndex += 1;
      shownAt = now;
    }
  }
  const stagesDone = () =>
    !minStageMs ||
    (shownIndex >= stageCount - 1 && performance.now() - shownAt >= minStageMs);

  function renderStage() {
    const stages = flow.t("stages");
    const index = shownIndex;
    const done = flow.progress >= 1;
    const stage = done ? flow.t("stageDone") : stages[index];
    for (const node of document.querySelectorAll("[data-progress-stage]"))
      node.textContent = stage.sense;
    for (const node of document.querySelectorAll("[data-progress-line]"))
      node.textContent = stage.line;
    const key = done ? stages.length : index;
    if (key !== flow.stage) {
      flow.stage = key;
      for (const node of document.querySelectorAll(
        "[data-progress-stage], [data-progress-line]",
      )) {
        node.animate(
          [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
      root.dataset.stage = String(key);
      emit("stage", key);
    }
  }

  // Reality being put together: one line after another, until loaded.
  function startBuilding() {
    const seconds = options.buildingSeconds;
    if (!seconds) return;
    let index = 0;
    const show = () => {
      const lines = flow.t("building");
      for (const node of document.querySelectorAll("[data-building-line]")) {
        node.textContent = `${lines[index % lines.length]} …`;
        node.animate(
          [
            { opacity: 0, transform: "translateY(5px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
      index += 1;
    };
    show();
    const timer = window.setInterval(() => {
      if (root.dataset.loaded === "true") window.clearInterval(timer);
      else show();
    }, seconds * 1000);
  }

  function startLoading() {
    startBuilding();
    const started = performance.now();
    const fontsReady = document.fonts.ready;
    let previous = started;
    const step = async () => {
      const now = performance.now();
      const elapsed = (now - started) / 1000;
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      rawProgress = curve(elapsed);
      if (paceSeconds) {
        // Ease toward the real value, never faster than the pace allows.
        const gap = Math.max(rawProgress - flow.progress, 0);
        const eased = gap * (1 - Math.exp(-4 * dt)) + 0.12 * dt;
        flow.progress += Math.min(eased, gap, dt / paceSeconds);
        if (rawProgress >= 1 && 1 - flow.progress < 0.002) flow.progress = 1;
        advanceStage();
      } else {
        advanceStage();
        flow.progress = stagesDone()
          ? rawProgress
          : Math.min(rawProgress, (shownIndex + 1) / stageCount - 0.001);
      }
      root.style.setProperty("--progress", flow.progress.toFixed(4));
      for (const node of document.querySelectorAll("[data-progress-value]")) {
        node.textContent = String(Math.floor(flow.progress * 100));
      }
      renderStage();
      emit("progress", flow.progress);
      if (flow.progress < 1) {
        requestAnimationFrame(step);
        return;
      }
      await fontsReady;
      root.dataset.loaded = "true";
      emit("loaded");
      if (options.beforeReady) await options.beforeReady();
      flow.ready = true;
      root.dataset.ready = "true";
      renderStage();
      emit("ready");
    };
    requestAnimationFrame(step);
  }

  // 5g. Start
  renderSettings();
  applyLanguage();
  if (params.has("skip")) {
    flow.progress = 1;
    flow.ready = true;
    root.dataset.ready = "true";
    root.style.setProperty("--progress", "1");
    document.fonts.ready.then(() => {
      root.dataset.loaded = "true";
      renderStage();
      emit("progress", 1);
      emit("loaded");
      emit("ready");
      go("menu");
    });
  } else {
    go("loading");
    startLoading();
  }

  return flow;
}
