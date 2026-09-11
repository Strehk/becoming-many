import { expect, test } from "bun:test";
import { Points, type PointsMaterial, Scene, Vector3 } from "three";
import type { StartAudio } from "../../../src/modules/start/audio/audio-contract";
import { connectFlightRoute } from "../../../src/modules/start/flight-path/flight-connection";
import {
  createFlightEntry,
  prependFlightEntry,
} from "../../../src/modules/start/flight-path/flight-entry";
import { createFlightRoute } from "../../../src/modules/start/flight-path/flight-route";
import { createStartModule } from "../../../src/modules/start/start.module";
import type {
  ExerciseVoiceCue,
  PlacedRoute,
  StartVoice,
} from "../../../src/modules/start/start-contract";
import {
  START_EXERCISES,
  START_SETTINGS,
} from "../../../src/modules/start/start-exercises";
import { StreamQueue } from "../../../src/world/stream-queue";

// Test-owned presentation keeps this fixture independent of external level recipes.
const PRESENTATION = {
  particles: {
    streaming: {
      chunkLevel: 0 as const,
      viewDistanceMeters: 16,
      fadeStartMeters: 12,
    },
    density: { particlesPerChunk: 16 },
    appearance: {
      color: 0x899096,
      sizeMeters: 0.045,
      shape: "circle" as const,
    },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 0.45,
    },
  },
  guidance: {
    color: 0xf0bc50,
    opacity: 0.6,
    lengthMeters: 18,
    behindMeters: 4,
    verticalBendMeters: 0.75,
    widthMeters: 3,
    belowFlightMeters: 0.5,
  },
};

function createViewpoint() {
  return {
    worldPosition: new Vector3(),
    worldFlightDirection: new Vector3(0, 0, -1),
    worldBodyDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(0, 0, -1),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 128,
  };
}

// Allow the entry's full soft edge to reach the first section before testing flight.
const ENTRY_READY_FRAMES =
  Math.ceil(
    ((START_SETTINGS.entryLineMeters +
      START_SETTINGS.entryBehindMeters +
      START_SETTINGS.pathGrowth.softEdgeMeters) /
      START_SETTINGS.pathGrowth.speedMetersPerSecond) *
      60,
  ) + 2;

function createFixture(
  warmFrames = ENTRY_READY_FRAMES,
  voice?: StartVoice,
  options: { atmosphere?: StartAudio; language?: "en" | "de" } = {},
) {
  const scene = new Scene();
  const viewpoint = createViewpoint();
  const queue = new StreamQueue({ budgetMilliseconds: 5, capacity: 256 });
  const module = createStartModule({
    scene,
    viewpoint,
    voice,
    ...options,
    parameters: PRESENTATION.particles,
    guidance: PRESENTATION.guidance,
    streamQueue: queue,
    constrainFlightPosition: () => {},
  });
  module.load();
  module.activate();
  const tick = () => {
    module.update?.(1 / 60);
    queue.update();
  };
  for (let frame = 0; frame < warmFrames; frame++) tick();
  return { scene, viewpoint, module, tick, queue };
}

function firstSection(
  fixture: ReturnType<typeof createFixture>,
  entryMeters = START_SETTINGS.entryLineMeters,
): PlacedRoute {
  const display = fixture.scene.getObjectByName("StartFlightPath") as Points;
  const position = display.position.clone();
  position.y += START_SETTINGS.belowFlightMeters;
  const entry = {
    route: createFlightEntry(
      entryMeters,
      fixture.viewpoint.worldFlightDirection,
    ),
    pose: { position, yawRadians: display.rotation.y },
  };
  const route = createFlightRoute(
    START_EXERCISES[0].route,
    START_SETTINGS.seed + 1,
  );
  return prependFlightEntry(entry, {
    route,
    pose: connectFlightRoute(entry, route),
  });
}

function flyRange(
  fixture: ReturnType<typeof createFixture>,
  section: PlacedRoute,
  range: [number, number],
): void {
  const up = new Vector3(0, 1, 0);
  for (let distance = range[0]; distance <= range[1] + 0.1; distance += 0.1) {
    section.route.sample(
      Math.min(distance, range[1]),
      fixture.viewpoint.worldPosition,
    );
    fixture.viewpoint.worldPosition
      .applyAxisAngle(up, section.pose.yawRadians)
      .add(section.pose.position);
    section.route.sampleDirection(
      distance,
      fixture.viewpoint.worldFlightDirection,
    );
    fixture.viewpoint.worldFlightDirection.applyAxisAngle(
      up,
      section.pose.yawRadians,
    );
    fixture.viewpoint.worldDirection.copy(
      fixture.viewpoint.worldFlightDirection,
    );
    fixture.tick();
  }
}

function trails(
  fixture: ReturnType<typeof createFixture>,
): Points<import("three").BufferGeometry, PointsMaterial>[] {
  return fixture.scene.children.filter(
    (child) => child.name === "StartFlightPath",
  ) as Points<import("three").BufferGeometry, PointsMaterial>[];
}

test("success prepares a joined successor while the original exit remains visible", () => {
  const fixture = createFixture();
  const section = firstSection(fixture);
  const first = trails(fixture)[1];
  const originalGeometry = first?.geometry;
  flyRange(fixture, section, [0, section.route.exerciseEndMeters]);
  for (let frame = 0; frame < 240; frame++) fixture.tick();
  expect(trails(fixture).length).toBeLessThanOrEqual(
    START_SETTINGS.pathPoolSize,
  );
  expect(first?.visible).toBe(true);
  flyRange(fixture, section, [
    section.route.exerciseEndMeters,
    section.route.lengthMeters,
  ]);
  for (
    let frame = 0;
    frame < Math.ceil(START_SETTINGS.retireSeconds * 60) + 30;
    frame++
  )
    fixture.tick();
  expect(trails(fixture).length).toBeLessThanOrEqual(
    START_SETTINGS.pathPoolSize,
  );
  expect(first?.visible).toBe(true);
  const next = trails(fixture).at(-1);
  if (!next) throw new Error("Missing successor");
  expect(next.material.opacity).toBe(START_SETTINGS.pathOpacity);
  const nextRoute = createFlightRoute(
    START_EXERCISES[1].route,
    START_SETTINGS.seed + 2,
  );
  const nextPose = {
    position: next.position
      .clone()
      .add(new Vector3(0, START_SETTINGS.belowFlightMeters, 0)),
    yawRadians: next.rotation.y,
  };
  const end = new Vector3();
  section.route.sample(section.route.lengthMeters, end);
  end
    .applyAxisAngle(new Vector3(0, 1, 0), section.pose.yawRadians)
    .add(section.pose.position);
  expect(nextPose.position.distanceTo(end)).toBeLessThan(1e-8);
  flyRange(fixture, { route: nextRoute, pose: nextPose }, [
    0,
    nextRoute.lengthMeters + START_SETTINGS.keepPathBehindMeters + 3,
  ]);
  for (
    let frame = 0;
    frame < Math.ceil(START_SETTINGS.retireSeconds * 60) + 30;
    frame++
  )
    fixture.tick();
  // Short sections can recycle the same pooled display after its old route retires.
  expect(!first?.visible || first.geometry !== originalGeometry).toBe(true);
  expect(trails(fixture).length).toBeLessThanOrEqual(
    START_SETTINGS.pathPoolSize,
  );
  const positions = next?.geometry.getAttribute("position");
  expect(
    positions?.getX((next?.geometry.drawRange.count ?? 1) - 1),
  ).toBeLessThan(0);
  fixture.module.unload();
  expect(fixture.scene.children).toHaveLength(0);
});

test("recovery offers a fixed line ahead of flight even when gaze points elsewhere", () => {
  const fixture = createFixture();
  const original = new Set(trails(fixture));
  fixture.viewpoint.worldFlightDirection.set(1, 0, 0);
  fixture.viewpoint.worldDirection.set(0, 1, 0);
  let entry: Points | undefined;
  for (let step = 1; step <= 100 && !entry; step++) {
    fixture.viewpoint.worldPosition.set(step * 0.25, 0, 0);
    fixture.tick();
    entry = trails(fixture).find((path) => !original.has(path));
  }
  if (!entry) throw new Error("Missing recovery approach");
  expect(entry.position.x - fixture.viewpoint.worldPosition.x).toBeCloseTo(
    START_SETTINGS.recoveryLeadMeters,
  );
  expect(entry.position.z).toBeCloseTo(0);
  const anchor = entry.position.clone();
  const player = fixture.viewpoint.worldPosition.clone();
  fixture.viewpoint.worldDirection.set(0, 1, 0);
  for (let frame = 0; frame < 250; frame++) fixture.tick();
  expect(entry.position.equals(anchor)).toBe(true);
  expect(fixture.viewpoint.worldPosition.equals(player)).toBe(true);
  expect(trails(fixture)).toHaveLength(2);
  fixture.module.unload();
  fixture.queue.update();
  expect(fixture.scene.children).toHaveLength(0);
});

test("activation puts a particle line under the rig before any rings appear", () => {
  const fixture = createFixture(0);
  expect(trails(fixture)).toHaveLength(1);
  expect(
    fixture.scene.children.some(
      (child) => child.name === "StartParticleElements",
    ),
  ).toBe(false);
  const line = trails(fixture)[0];
  if (!line) throw new Error("Missing immediate entry");
  expect(line.position.x).toBe(0);
  expect(line.position.z).toBe(0);
  const positions = line.geometry.getAttribute("position");
  let behind = false,
    ahead = false,
    near = false;
  for (let index = 0; index < positions.count; index++) {
    behind ||= positions.getZ(index) > 1;
    ahead ||= positions.getZ(index) < -10;
    near ||= Math.abs(positions.getZ(index)) < 0.5;
  }
  expect(behind && ahead && near).toBe(true);
  fixture.module.unload();
});

test("unload cancels unfinished generation and cannot publish stale geometry", () => {
  const fixture = createFixture();
  fixture.module.deactivate();
  fixture.module.activate();
  fixture.module.unload();
  for (let frame = 0; frame < 40; frame++) fixture.queue.update();
  expect(fixture.scene.children).toHaveLength(0);
  expect(fixture.queue.size).toBe(0);
});

test("immediate flight keeps progress while route generation is delayed", () => {
  const fixture = createFixture(0);
  const section = firstSection(fixture);
  for (let frame = 0; frame < 100; frame++) {
    fixture.viewpoint.worldPosition.z -= 0.04;
    fixture.module.update?.(1 / 60);
  }
  flyRange(fixture, section, [4, section.route.exerciseEndMeters]);
  for (
    let frame = 0;
    frame < Math.ceil(START_SETTINGS.retireSeconds * 60) + 30;
    frame++
  )
    fixture.tick();
  expect(trails(fixture).length).toBeLessThanOrEqual(
    START_SETTINGS.pathPoolSize,
  );
  const successor = trails(fixture).at(-1);
  const end = new Vector3();
  section.route.sample(section.route.lengthMeters, end);
  end.add(section.pose.position);
  expect(successor?.position.x).toBeCloseTo(end.x);
  expect(successor?.position.z).toBeCloseTo(end.z);
  fixture.module.unload();
});

test.each([
  { language: "de" as const, path: 6.38, room: 13.36, instruction: 19.3 },
  { language: "en" as const, path: 8, room: 12.94, instruction: 17.16 },
])(
  "$language native speech gates the course and failure never releases rings",
  ({ language, path, room, instruction }) => {
    const calls: { cue: ExerciseVoiceCue; offset: number }[] = [];
    const playback = { offsetSeconds: 0, ended: false, failed: false };
    let stops = 0;
    let presence = 1;
    const voice: StartVoice = {
      play: (cue, offset) => {
        calls.push({ cue, offset });
      },
      read: () => playback,
      setPresence: (next) => {
        presence = next;
      },
      stop: () => {
        stops++;
      },
    };
    const fixture = createFixture(180, voice, { language });
    fixture.module.setPresence(0.4);
    expect(presence).toBe(0.4);
    fixture.module.setPresence(1);
    expect(calls[0]?.cue.url).toBe(
      `/audio/tutorial/${language}/introduction-right.wav`,
    );
    expect(trails(fixture)).toHaveLength(0);
    playback.offsetSeconds = path;
    fixture.tick();
    expect(trails(fixture)).toHaveLength(0);
    playback.offsetSeconds = path + 1.6;
    for (let frame = 0; frame < 30; frame++) fixture.tick();
    expect(trails(fixture)).toHaveLength(1);
    for (let frame = 0; frame < ENTRY_READY_FRAMES; frame++) fixture.tick();
    expect(trails(fixture)).toHaveLength(2);
    expect(
      fixture.scene.getObjectByName("StartParticleElements"),
    ).toBeUndefined();
    expect(trails(fixture)[0]?.material.opacity).toBeCloseTo(
      START_SETTINGS.pathOpacity * 0.5,
    );
    playback.offsetSeconds = room;
    fixture.tick();
    expect(trails(fixture)[0]?.material.opacity).toBeCloseTo(
      START_SETTINGS.pathOpacity,
    );
    playback.offsetSeconds = instruction - 0.01;
    fixture.tick();
    expect(trails(fixture)).toHaveLength(2);
    expect(
      fixture.scene.getObjectByName("StartParticleElements"),
    ).toBeUndefined();
    playback.offsetSeconds = instruction;
    playback.failed = true;
    fixture.tick();
    expect(trails(fixture)).toHaveLength(2);
    expect(
      fixture.scene.getObjectByName("StartParticleElements"),
    ).toBeUndefined();
    playback.failed = false;
    fixture.tick();
    expect(trails(fixture)).toHaveLength(2);
    expect(
      fixture.scene.getObjectByName("StartParticleElements"),
    ).toBeDefined();
    fixture.module.deactivate();
    expect(stops).toBe(1);
    fixture.module.unload();
    expect(fixture.scene.children).toHaveLength(0);
  },
);

test("flying straight cannot earn the narrated right turn", () => {
  const played: string[] = [];
  const playback = { offsetSeconds: 0, ended: false, failed: false };
  const fixture = createFixture(0, {
    play: (cue) => {
      played.push(cue.url);
    },
    read: () => playback,
    setPresence: () => {},
    stop: () => {},
  });
  playback.offsetSeconds = 14;
  for (let frame = 0; frame < 30; frame++) fixture.tick();
  playback.offsetSeconds = 20.725729;
  playback.ended = true;
  for (let frame = 0; frame < 30; frame++) fixture.tick();
  for (let step = 0; step < 1000; step++) {
    fixture.viewpoint.worldPosition.z -= 0.1;
    fixture.tick();
  }
  expect(played.length).toBeGreaterThan(0);
  expect(played.every((url) => url.endsWith("introduction-right.wav"))).toBe(
    true,
  );
  fixture.module.unload();
});

test("following the right arc earns the next voice only after the current voice ends", () => {
  const played: string[] = [];
  const playback = { offsetSeconds: 0, ended: false, failed: false };
  const fixture = createFixture(0, {
    play: (cue) => {
      played.push(cue.url);
      playback.offsetSeconds = 0;
      playback.ended = false;
    },
    read: () => playback,
    setPresence: () => {},
    stop: () => {},
  });
  playback.offsetSeconds = 14;
  for (let frame = 0; frame < 30; frame++) fixture.tick();
  playback.offsetSeconds = 19.5;
  for (let frame = 0; frame < 30; frame++) fixture.tick();
  const section = firstSection(
    fixture,
    START_EXERCISES[0].sequence.approachMeters,
  );
  flyRange(fixture, section, [0, section.route.exerciseEndMeters]);
  expect(played).toHaveLength(1);
  playback.ended = true;
  for (let frame = 0; frame < 240; frame++) fixture.tick();
  expect(played[1]).toEndWith("left.wav");
  expect(played).toHaveLength(2);
  fixture.module.unload();
});

function createClosingFixture() {
  const played: string[] = [];
  const playback = { offsetSeconds: 0, ended: false, failed: false };
  const fixture = createFixture(0, {
    play: (cue) => {
      played.push(cue.url);
      playback.offsetSeconds = 0;
      playback.ended = false;
    },
    read: () => playback,
    setPresence: () => {},
    stop: () => {},
  });
  playback.offsetSeconds = START_EXERCISES[0].voice.durationSeconds;
  playback.ended = true;
  for (let frame = 0; frame < 240; frame++) fixture.tick();
  return { fixture, playback, played };
}

test("deadline starts the full closing voice without passage and preserves its natural end", () => {
  const { fixture, playback, played } = createClosingFixture();
  fixture.module.update?.(86.1);
  expect(played.at(-1)).toBe(START_SETTINGS.completeVoice.url);
  expect(
    played.filter((url) => url === START_SETTINGS.completeVoice.url),
  ).toHaveLength(1);
  expect(fixture.module.readComplete()).toBe(false);
  fixture.module.update?.(1);
  expect(fixture.module.readComplete()).toBe(false);
  playback.offsetSeconds = START_SETTINGS.completeVoice.durationSeconds;
  playback.ended = true;
  fixture.tick();
  expect(fixture.module.readComplete()).toBe(true);
  expect(
    played.filter((url) => url === START_SETTINGS.completeVoice.url),
  ).toHaveLength(1);
  fixture.module.unload();
});

test("closing atmosphere fades progressively while narration and resources stay alive", () => {
  const playback = { offsetSeconds: 0, ended: false, failed: false };
  let presence = 1;
  let stopped = false;
  const fixture = createFixture(
    0,
    {
      play: () => {
        playback.offsetSeconds = 0;
        playback.ended = false;
      },
      read: () => playback,
      setPresence: (next) => {
        presence = next;
      },
      stop: () => {
        stopped = true;
      },
    },
    {
      atmosphere: {
        configureSection: () => {},
        updateSection: () => {},
        clearSection: () => {},
        unload: () => {},
        update: (frame) => {
          presence = frame.presence ?? 1;
        },
      },
    },
  );
  playback.offsetSeconds = 21;
  playback.ended = true;
  fixture.module.update?.(90);
  expect(presence).toBe(1);
  playback.offsetSeconds = 3;
  fixture.tick();
  expect(presence).toBeCloseTo(0.5);
  playback.offsetSeconds = 6;
  fixture.tick();
  expect(presence).toBe(0);
  expect(stopped).toBe(false);
  expect(fixture.module.readComplete()).toBe(false);
  fixture.module.unload();
});

function finishNarratedCourse(
  closing: ReturnType<typeof createClosingFixture>,
): void {
  const { fixture, playback } = closing;
  let section = firstSection(
    fixture,
    START_EXERCISES[0].sequence.approachMeters,
  );
  for (let index = 0; index < START_EXERCISES.length; index++) {
    flyRange(fixture, section, [0, section.route.exerciseEndMeters]);
    expect(fixture.module.readComplete()).toBe(false);
    const next = START_EXERCISES[index + 1];
    if (next) {
      playback.offsetSeconds = next.voice.durationSeconds;
      playback.ended = true;
    }
    for (let frame = 0; frame < 240; frame++) fixture.tick();
    flyRange(fixture, section, [
      section.route.exerciseEndMeters,
      section.route.lengthMeters,
    ]);
    if (!next) break;
    const route = createFlightRoute(
      next.route,
      START_SETTINGS.seed + index + 2,
    );
    section = { route, pose: connectFlightRoute(section, route) };
  }
}

test("handoff waits for the final exit and a successful natural closing voice end", () => {
  const closing = createClosingFixture();
  const { fixture, played, playback } = closing;
  finishNarratedCourse(closing);
  expect(played.at(-1)).toBe(START_SETTINGS.completeVoice.url);
  expect(fixture.module.readComplete()).toBe(false);
  playback.ended = true;
  playback.failed = true;
  expect(fixture.module.readComplete()).toBe(false);
  playback.failed = false;
  expect(fixture.module.readComplete()).toBe(false);
  playback.offsetSeconds = START_SETTINGS.completeVoice.durationSeconds;
  fixture.tick();
  expect(fixture.module.readComplete()).toBe(true);
  fixture.module.deactivate();
  expect(fixture.module.readComplete()).toBe(false);
  fixture.module.unload();
});

function createAtmosphereFixture() {
  let presence = 1;
  const atmosphere: StartAudio = {
    configureSection: () => {},
    updateSection: () => {},
    clearSection: () => {},
    unload: () => {},
    update: (frame) => {
      presence = frame.presence ?? 1;
    },
  };
  return {
    fixture: createFixture(600, undefined, { atmosphere }),
    readPresence: () => presence,
  };
}

test("handoff presence fades every rendered cloud and reaches atmosphere once", () => {
  const { fixture, readPresence } = createAtmosphereFixture();
  const clouds = fixture.scene.children.filter(
    (child) => child instanceof Points,
  ) as Points<import("three").BufferGeometry, PointsMaterial>[];
  expect(clouds.some((cloud) => cloud.name === "StartParticleElements")).toBe(
    true,
  );
  const original = clouds.map((cloud) => cloud.material.opacity);
  fixture.module.setPresence(0.25);
  fixture.module.update?.(0);
  clouds.forEach((cloud, index) => {
    expect(cloud.material.opacity).toBeCloseTo((original[index] ?? 0) * 0.25);
  });
  expect(readPresence()).toBe(0.25);
  expect(fixture.module.readComplete()).toBe(false);
  fixture.module.setPresence(0);
  fixture.module.update?.(0);
  expect(clouds.every((cloud) => cloud.material.opacity === 0)).toBe(true);
  expect(readPresence()).toBe(0);
  fixture.module.activate();
  fixture.module.update?.(0);
  expect(readPresence()).toBe(1);
  fixture.module.unload();
});
