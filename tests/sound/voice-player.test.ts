import { expect, test } from "bun:test";
import { createVoicePlayer } from "../../src/sound/voice-player";

class Media extends EventTarget {
  src = "";
  private offset = 0;
  seeking = false;
  simulateSeeking = false;
  get currentTime() {
    return this.offset;
  }
  set currentTime(offset: number) {
    this.offset = offset;
    if (this.simulateSeeking) this.seeking = true;
  }
  readyState = 1;
  preload = "";
  volume = 1;
  ended = false;
  error: object | null = null;
  pauses = 0;
  starts = 0;
  nextPlay: () => Promise<void> = () => Promise.resolve();
  play = () => {
    this.starts++;
    return this.nextPlay();
  };
  pause = () => {
    this.pauses++;
  };
  load = () => {};
  getAttribute = () => this.src;
  removeAttribute = () => {
    this.src = "";
  };
}
function fixture() {
  const audio = new Media();
  const gestures = new EventTarget();
  const voice = createVoicePlayer({
    gestures,
    createAudio: () => audio as unknown as HTMLAudioElement,
  });
  return { audio, gestures, voice };
}
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("pause preserves native offset and cannot be undone by gestures or late play", async () => {
  const { audio, gestures, voice } = fixture();
  audio.readyState = 4;
  voice.setPaused(true);
  voice.play({ url: "/voice.wav" }, 0);
  expect(audio.starts).toBe(0);
  voice.setPaused(false);
  await settle();
  audio.currentTime = 7;
  voice.setPaused(true);
  expect(voice.readStatus()).toBe("paused");
  expect(voice.read().offsetSeconds).toBe(7);
  gestures.dispatchEvent(new Event("pointerdown"));
  expect(audio.starts).toBe(1);
  const pending = Promise.withResolvers<void>();
  audio.nextPlay = () => pending.promise;
  voice.setPaused(false);
  voice.setPaused(true);
  pending.resolve();
  await settle();
  expect(voice.readStatus()).toBe("paused");
  expect(audio.currentTime).toBe(7);
  audio.nextPlay = () => Promise.resolve();
  voice.setPaused(false);
  await settle();
  expect(voice.readStatus()).toBe("playing");
  expect(voice.read().offsetSeconds).toBe(7);
  voice.unload();
});

test("native offset and natural end are distinct from playback failure", async () => {
  const { audio, voice } = fixture();
  voice.play({ url: "/voice.wav" }, 1.14);
  expect(voice.read().offsetSeconds).toBe(0);
  await settle();
  audio.currentTime = 2;
  expect(voice.read().offsetSeconds).toBe(2);
  audio.ended = true;
  expect(voice.read().ended).toBe(true);
  audio.error = {};
  expect(voice.read()).toEqual({
    offsetSeconds: 0,
    ended: false,
    failed: true,
  });
  voice.unload();
});

test("autoplay denial retries only on gesture and keeps the requested excerpt", async () => {
  const { audio, gestures, voice } = fixture();
  audio.nextPlay = () =>
    Promise.reject(new DOMException("blocked", "NotAllowedError"));
  voice.play({ url: "/voice.wav" }, 19.3);
  await settle();
  expect(voice.read().failed).toBe(true);
  expect(audio.starts).toBe(1);
  audio.nextPlay = () => Promise.resolve();
  gestures.dispatchEvent(new Event("pointerdown"));
  await settle();
  expect(voice.read().offsetSeconds).toBe(19.3);
  expect(voice.read().failed).toBe(false);
  gestures.dispatchEvent(new Event("keydown"));
  expect(audio.starts).toBe(2);
  voice.unload();
});

test("late metadata applies the requested seek, stop invalidates pending play", async () => {
  const { audio, gestures, voice } = fixture();
  audio.readyState = 0;
  let resolvePlay = () => {};
  audio.nextPlay = () =>
    new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
  voice.play({ url: "/voice.wav" }, 2.66);
  expect(voice.read().offsetSeconds).toBe(0);
  audio.readyState = 1;
  audio.dispatchEvent(new Event("loadedmetadata"));
  expect(audio.currentTime).toBe(2.66);
  voice.stop();
  resolvePlay();
  await settle();
  expect(voice.read()).toEqual({
    offsetSeconds: 0,
    ended: false,
    failed: false,
  });
  voice.unload();
  voice.unload();
  gestures.dispatchEvent(new Event("pointerdown"));
  expect(audio.starts).toBe(1);
  expect(audio.src).toBe("");
});

test("presence fades without interrupting playback and survives clip changes", async () => {
  const { audio, voice } = fixture();
  voice.play({ url: "/first.wav" }, 0);
  await settle();
  audio.currentTime = 3;
  const pauses = audio.pauses;
  voice.setPresence(0.4);
  expect(audio.volume).toBe(0.4);
  expect(audio.pauses).toBe(pauses);
  expect(voice.read().offsetSeconds).toBe(3);
  voice.play({ url: "/next.wav" }, 0);
  expect(audio.volume).toBe(0.4);
  voice.setPresence(2);
  expect(audio.volume).toBe(1);
  voice.setPresence(-1);
  expect(audio.volume).toBe(0);
  voice.setPresence(Number.NaN);
  expect(audio.volume).toBe(0);
  voice.unload();
  voice.setPresence(1);
  expect(audio.volume).toBe(0);
});

function replacementFixture() {
  const sources: Media[] = [];
  const gestures = new EventTarget();
  const voice = createVoicePlayer({
    gestures,
    createAudio: () => {
      const audio = new Media();
      audio.readyState = sources.length ? 0 : 4;
      sources.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
  });
  voice.play({ url: "/en.wav" }, 0);
  return { sources, voice, gestures };
}

function sourceAt(sources: readonly Media[], index: number): Media {
  const audio = sources[index];
  if (!audio) throw new Error(`Expected media source ${index}`);
  return audio;
}

function ready(audio: Media) {
  audio.readyState = 4;
  audio.dispatchEvent(new Event("canplay"));
}

test("replacement keeps old speech and stable cue time through loading, seek and play", async () => {
  const { sources, voice } = replacementFixture();
  await settle();
  const original = sourceAt(sources, 0);
  original.currentTime = 4;
  const pauses = original.pauses;
  voice.replace({
    url: "/de.wav",
    timeMap: [{ offsetSeconds: 10, nativeSeconds: 20 }],
  });
  const replacement = sourceAt(sources, 1);
  replacement.simulateSeeking = true;
  const starting = Promise.withResolvers<void>();
  replacement.nextPlay = () => starting.promise;
  expect(voice.readStatus()).toBe("playing");
  expect(voice.read().offsetSeconds).toBe(4);
  expect(original.pauses).toBe(pauses);
  ready(replacement);
  expect(replacement.currentTime).toBe(8);
  expect(replacement.starts).toBe(0);
  replacement.seeking = false;
  replacement.dispatchEvent(new Event("seeked"));
  expect(replacement.starts).toBe(1);
  expect(replacement.volume).toBe(0);
  original.currentTime = 5;
  starting.resolve();
  await settle();
  expect(original.pauses).toBe(pauses);
  expect(replacement.currentTime).toBe(10);
  replacement.seeking = false;
  replacement.dispatchEvent(new Event("seeked"));
  expect(original.src).toBe("");
  expect(replacement.volume).toBe(1);
  expect(voice.read().offsetSeconds).toBe(5);
  expect(voice.readStatus()).toBe("playing");
  voice.unload();
});

test("rapid switches and reverting to current language cancel obsolete sources", async () => {
  const { sources, voice } = replacementFixture();
  await settle();
  sourceAt(sources, 0).currentTime = 3;
  voice.replace({ url: "/de.wav" });
  voice.replace({ url: "/en.wav" });
  expect(sourceAt(sources, 1).src).toBe("");
  ready(sourceAt(sources, 1));
  expect(sourceAt(sources, 1).starts).toBe(0);
  expect(sourceAt(sources, 0).src).toBe("/en.wav");
  voice.replace({ url: "/de.wav" });
  voice.replace({ url: "/de.wav" });
  expect(sources).toHaveLength(3);
  ready(sourceAt(sources, 2));
  await settle();
  expect(sourceAt(sources, 2).src).toBe("/de.wav");
  expect(voice.read().offsetSeconds).toBe(3);
  voice.unload();
});

test("failed and blocked replacements preserve speech, support retry and respect pause", async () => {
  const { sources, voice, gestures } = replacementFixture();
  await settle();
  voice.replace({ url: "/de.wav" });
  sourceAt(sources, 1).dispatchEvent(new Event("error"));
  expect(voice.readStatus()).toBe("playing");
  voice.replace({ url: "/de.wav" });
  const candidate = sourceAt(sources, 2);
  candidate.nextPlay = () =>
    Promise.reject(new DOMException("blocked", "NotAllowedError"));
  ready(candidate);
  await settle();
  expect(voice.readStatus()).toBe("playing");
  candidate.nextPlay = () => Promise.resolve();
  voice.setPaused(true);
  expect(voice.readStatus()).toBe("paused");
  gestures.dispatchEvent(new Event("pointerdown"));
  await settle();
  expect(voice.readStatus()).toBe("paused");
  voice.setPaused(false);
  await settle();
  expect(voice.readStatus()).toBe("playing");
  expect(sourceAt(sources, 0).src).toBe("");
  voice.unload();
});

test("pause while replacement play is pending cannot be undone by its late result", async () => {
  const { sources, voice } = replacementFixture();
  await settle();
  voice.replace({ url: "/de.wav" });
  const pending = Promise.withResolvers<void>();
  const candidate = sourceAt(sources, 1);
  candidate.nextPlay = () => pending.promise;
  ready(candidate);
  voice.setPaused(true);
  pending.resolve();
  await settle();
  expect(voice.readStatus()).toBe("paused");
  expect(candidate.volume).toBe(1);
  candidate.nextPlay = () => Promise.resolve();
  voice.setPaused(false);
  await settle();
  expect(voice.readStatus()).toBe("playing");
  voice.unload();
});

test("natural end during preparation never replays the completed recording", async () => {
  const { sources, voice } = replacementFixture();
  await settle();
  voice.replace({ url: "/de.wav" });
  sourceAt(sources, 0).ended = true;
  ready(sourceAt(sources, 1));
  expect(sourceAt(sources, 1).starts).toBe(0);
  expect(sourceAt(sources, 1).src).toBe("");
  expect(voice.read().ended).toBe(true);
  voice.unload();
});

test.each(["stop", "unload"] as const)(
  "%s releases replacement and rejects late starts",
  async (command) => {
    const { sources, voice, gestures } = replacementFixture();
    await settle();
    voice.replace({ url: "/de.wav" });
    const pending = Promise.withResolvers<void>();
    sourceAt(sources, 1).nextPlay = () => pending.promise;
    ready(sourceAt(sources, 1));
    voice[command]();
    pending.resolve();
    await settle();
    gestures.dispatchEvent(new Event("pointerdown"));
    expect(sourceAt(sources, 1).src).toBe("");
    expect(sourceAt(sources, 1).volume).toBe(0);
    expect(voice.readStatus()).toBe("ended");
    voice.unload();
  },
);

test("replacement preserves an initial paused excerpt before original metadata loads", async () => {
  const { sources, voice } = replacementFixture();
  const original = sourceAt(sources, 0);
  voice.stop();
  original.readyState = 0;
  voice.setPaused(true);
  voice.play({ url: "/en.wav" }, 4);
  voice.replace({
    url: "/de.wav",
    timeMap: [{ offsetSeconds: 10, nativeSeconds: 20 }],
  });
  const replacement = sourceAt(sources, 1);
  ready(replacement);
  expect(replacement.currentTime).toBe(8);
  expect(replacement.starts).toBe(0);
  expect(voice.read().offsetSeconds).toBe(4);
  expect(voice.readStatus()).toBe("paused");
  voice.setPaused(false);
  await settle();
  expect(voice.read().offsetSeconds).toBe(4);
  expect(voice.readStatus()).toBe("playing");
  voice.unload();
});

test("slow replacement seeks are bounded while the original speech keeps advancing", async () => {
  const { sources, voice } = replacementFixture();
  await settle();
  const original = sourceAt(sources, 0);
  original.currentTime = 1;
  voice.replace({ url: "/de.wav" });
  const replacement = sourceAt(sources, 1);
  replacement.simulateSeeking = true;
  ready(replacement);
  expect(replacement.currentTime).toBe(1);
  original.currentTime = 1.2;
  replacement.seeking = false;
  replacement.dispatchEvent(new Event("seeked"));
  expect(replacement.starts).toBe(1);
  await settle();
  expect(replacement.currentTime).toBe(1.2);
  original.currentTime = 1.4;
  expect(voice.read().offsetSeconds).toBe(1.4);
  replacement.seeking = false;
  replacement.dispatchEvent(new Event("seeked"));
  expect(replacement.seeking).toBe(false);
  expect(replacement.starts).toBe(1);
  expect(original.src).toBe("");
  expect(voice.read().offsetSeconds).toBe(1.4);
  expect(voice.readStatus()).toBe("playing");
  voice.unload();
});
