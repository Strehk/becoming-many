/**
 * Purpose: Say every word the conductor page speaks, in each language a
 *   station is run in.
 * Context: Front-of-house staff read this page under pressure, and the venue
 *   decides which language that is. The piece's own narration language is a
 *   separate choice the operator arms per visitor.
 * Responsibility: Own the two catalogues and the chapter names, as typed data.
 * Boundary: Which words a reading deserves is decided by the panel that takes
 *   the reading; this file only knows how to say them. Narration recordings
 *   live in the narration catalogue.
 */

import { cueDisplayName } from "./time-format";

/** The languages the page itself is read in; the drawer switches between them. */
export const OPERATOR_LANGUAGES = ["en", "de"] as const;

export type OperatorLanguage = (typeof OPERATOR_LANGUAGES)[number];

/** What a status tile can say, before a language turns it into a word. */
export type StatusValue =
  | "ok"
  | "asleep"
  | "measuring"
  | "check"
  | "connecting"
  | "streaming"
  | "ready"
  | "none";

/** What the transport pill can say. */
export type TransportStatus = "running" | "held" | "finished";

/** What the headset button can offer. */
export type StreamAction = "start" | "stop" | "unavailable";

export interface ConductorCopy {
  /** The catalogue names itself, so a panel needs no second field to compare. */
  readonly language: OperatorLanguage;

  readonly status: {
    readonly ariaLabel: string;
    readonly sound: string;
    readonly picture: string;
    readonly controller: string;
    readonly headset: string;
    readonly values: Readonly<Record<StatusValue, string>>;
    /** The one fault a front-of-house person must act on. */
    readonly wrongDeviceBanner: string;
  };

  readonly transport: {
    readonly ariaLabel: string;
    readonly play: string;
    readonly hold: string;
    readonly statuses: Readonly<Record<TransportStatus, string>>;
    readonly now: string;
    readonly next: string;
    /** How much show is left, as the operator reads it beside the clock. */
    readonly remaining: (time: string) => string;
    /** How far off the next cue is. */
    readonly until: (time: string) => string;
    readonly nudge: (seconds: number) => string;
  };

  readonly timeline: {
    readonly ariaLabel: string;
    /** A cue id as a chapter name; an unnamed id still reads as itself. */
    readonly chapter: (cueId: string) => string;
  };

  readonly session: {
    readonly ariaLabel: string;
    /** Labels the narration switch, which is not this page's own language. */
    readonly narrationLanguage: string;
    readonly restart: string;
    readonly restartArmed: string;
    readonly stream: Readonly<Record<StreamAction, string>>;
    readonly techToggle: string;
  };

  readonly drawer: {
    readonly title: string;
    readonly close: string;
    readonly caution: string;
    readonly stageView: string;
    readonly rehearsalSpeed: string;
    readonly resets: string;
    readonly rewind: string;
    readonly resetFlight: string;
    readonly reload: string;
    readonly reloadArmed: string;
    readonly m5: string;
    readonly pageLanguage: string;
    readonly readouts: {
      readonly frames: string;
      readonly m5: string;
      readonly level: string;
      readonly audio: string;
      readonly language: string;
    };
  };

  readonly stage: {
    readonly streamingOverlay: string;
  };

  readonly m5: {
    readonly ariaLabel: string;
    readonly host: string;
    readonly lockedTitle: string;
    readonly set: string;
    readonly clear: string;
  };

  readonly wake: {
    readonly headline: string;
    readonly hint: string;
    readonly pill: string;
  };
}

/**
 * The chapter names, per language, keyed by the schedule's cue ids. A cue
 * without a name here still reads as its own id, so a schedule can gain a cue
 * without the page falling silent about it; the table is exported so
 * `tests/conductor/conductor-copy.test.ts` can hold it against the schedule
 * and keep the piece's own cues named in both languages.
 */
export const CHAPTER_NAMES: Readonly<
  Record<OperatorLanguage, Readonly<Record<string, string>>>
> = {
  en: {
    prologue: "Prologue",
    scent: "Scent",
    echo: "Echo",
    motion: "Motion",
    thermal: "Thermal",
    magnetic: "Magnetic",
    finale: "Finale",
    return: "Return",
  },
  de: {
    prologue: "Prolog",
    scent: "Geruch",
    echo: "Echo",
    motion: "Bewegung",
    thermal: "Wärme",
    magnetic: "Magnetfeld",
    finale: "Finale",
    return: "Rückkehr",
  },
};

function chapterNamer(language: OperatorLanguage): (cueId: string) => string {
  const names = CHAPTER_NAMES[language];

  return (cueId) => names[cueId] ?? cueDisplayName(cueId);
}

const ENGLISH: ConductorCopy = {
  language: "en",

  status: {
    ariaLabel: "Station status",
    sound: "Sound",
    picture: "Picture",
    controller: "Controller",
    headset: "Headset",
    values: {
      ok: "OK",
      asleep: "Asleep",
      measuring: "Measuring",
      check: "Check",
      connecting: "Connecting",
      streaming: "Streaming",
      ready: "Ready",
      none: "—",
    },
    wrongDeviceBanner:
      "The hand controller is not answering as this station's own. The show keeps playing — call a technician before the next visitor steers.",
  },

  transport: {
    ariaLabel: "Transport",
    play: "Play",
    hold: "Hold",
    statuses: {
      running: "Running",
      held: "On hold",
      finished: "Finished",
    },
    now: "now",
    next: "next",
    remaining: (time) => `${time} left`,
    until: (time) => `in ${time}`,
    nudge: (seconds) => `${seconds} s`,
  },

  timeline: {
    ariaLabel: "Show timeline",
    chapter: chapterNamer("en"),
  },

  session: {
    ariaLabel: "Session",
    narrationLanguage: "Language",
    restart: "New visitor",
    restartArmed: "Tap again to reset",
    stream: {
      start: "Start headset picture",
      stop: "Stop headset picture",
      unavailable: "No headset connected",
    },
    techToggle: "Technician tools",
  },

  drawer: {
    title: "Technician tools",
    close: "Close technician tools",
    caution:
      "These controls can interrupt a live show. Close this panel before handing the station back.",
    stageView: "Stage view",
    rehearsalSpeed: "Rehearsal speed",
    resets: "Resets",
    rewind: "Rewind to start and hold",
    resetFlight: "Reset flight position",
    reload: "Reload the page",
    reloadArmed: "Tap again to reload",
    m5: "M5 controller",
    pageLanguage: "Page language",
    readouts: {
      frames: "frames",
      m5: "m5",
      level: "level",
      audio: "audio",
      language: "language",
    },
  },

  stage: {
    streamingOverlay: "streaming — paused",
  },

  m5: {
    ariaLabel: "M5 controller",
    host: "M5 host",
    lockedTitle: "Set by the station's deployment config",
    set: "Set",
    clear: "Clear",
  },

  wake: {
    headline: "The station is asleep",
    hint: "Tap anywhere on this screen to wake the sound.",
    pill: "Tap to wake",
  },
};

/** The script addresses its visitor with "du"; the station reads the same way. */
const GERMAN: ConductorCopy = {
  language: "de",

  status: {
    ariaLabel: "Stationsstatus",
    sound: "Ton",
    picture: "Bild",
    controller: "Controller",
    headset: "Headset",
    values: {
      ok: "OK",
      asleep: "Schläft",
      measuring: "Misst",
      check: "Prüfen",
      connecting: "Verbindet",
      streaming: "Überträgt",
      ready: "Bereit",
      none: "—",
    },
    wrongDeviceBanner:
      "Der Handcontroller antwortet nicht als der eigene dieser Station. Die Vorstellung läuft weiter — hol die Technik, bevor der nächste Gast steuert.",
  },

  transport: {
    ariaLabel: "Transport",
    play: "Abspielen",
    hold: "Anhalten",
    statuses: {
      running: "Läuft",
      held: "Angehalten",
      finished: "Beendet",
    },
    now: "jetzt",
    next: "danach",
    remaining: (time) => `noch ${time}`,
    until: (time) => `in ${time}`,
    nudge: (seconds) => `${seconds} s`,
  },

  timeline: {
    ariaLabel: "Ablauf",
    chapter: chapterNamer("de"),
  },

  session: {
    ariaLabel: "Sitzung",
    narrationLanguage: "Sprache",
    restart: "Neuer Gast",
    restartArmed: "Nochmal tippen: zurücksetzen",
    stream: {
      start: "Headset-Bild starten",
      stop: "Headset-Bild beenden",
      unavailable: "Kein Headset verbunden",
    },
    techToggle: "Technik",
  },

  drawer: {
    title: "Technik",
    close: "Technik schließen",
    caution:
      "Diese Bedienelemente können eine laufende Vorstellung unterbrechen. Schließe dieses Feld, bevor du die Station zurückgibst.",
    stageView: "Bühnenansicht",
    rehearsalSpeed: "Probentempo",
    resets: "Zurücksetzen",
    rewind: "An den Anfang und anhalten",
    resetFlight: "Flugposition zurücksetzen",
    reload: "Seite neu laden",
    reloadArmed: "Nochmal tippen: neu laden",
    m5: "M5-Controller",
    pageLanguage: "Sprache der Oberfläche",
    readouts: {
      frames: "Frames",
      m5: "m5",
      level: "Ebene",
      audio: "Audio",
      language: "Sprache",
    },
  },

  stage: {
    streamingOverlay: "überträgt — angehalten",
  },

  m5: {
    ariaLabel: "M5-Controller",
    host: "M5-Adresse",
    lockedTitle: "Von der Deployment-Konfiguration der Station gesetzt",
    set: "Setzen",
    clear: "Leeren",
  },

  wake: {
    headline: "Die Station schläft",
    hint: "Tippe irgendwo auf diesen Bildschirm, um den Ton zu wecken.",
    pill: "Zum Wecken tippen",
  },
};

export const CONDUCTOR_COPY: Readonly<Record<OperatorLanguage, ConductorCopy>> =
  {
    en: ENGLISH,
    de: GERMAN,
  };
