import { expect, test } from "bun:test";
import { createVoicePlayer } from "../../src/sound/voice-player";

class Media extends EventTarget {
  src = "";
  currentTime = 0;
  readyState = 1;
  preload = "";
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
