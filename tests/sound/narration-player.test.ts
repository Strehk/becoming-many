import { expect, test } from "bun:test";

test("narration writes changed native intent once and bounds rejected or pending play attempts", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import assert from "node:assert/strict";
    const clips = [];
    let warnings = 0;
    console.warn = () => warnings++;
    class Audio {
      position = 0; rate = 1; paused = true; ended = false; readyState = 0;
      seeks = 0; rates = 0; plays = 0; pauses = 0;
      mode = "allow"; pending = undefined;
      constructor(src) { this.src = src; clips.push(this); }
      // Native getters may round without changing the exact requested seek.
      get currentTime() { return Math.round(this.position * 1e6) / 1e6; }
      set currentTime(seconds) { this.seeks++; this.position = seconds; }
      get playbackRate() { return this.rate; }
      set playbackRate(rate) { this.rates++; this.rate = rate; }
      play() {
        this.plays++;
        if (this.mode === "reject") return Promise.reject(new DOMException("Blocked", "NotAllowedError"));
        if (this.mode === "pending") return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
        this.paused = false;
        return Promise.resolve();
      }
      pause() { this.pauses++; this.paused = true; this.pending?.reject(new DOMException("Paused", "AbortError")); this.pending = undefined; }
      removeAttribute(name) { if (name === "src") this.src = ""; }
      load() {}
    }
    globalThis.Audio = Audio;
    globalThis.HTMLMediaElement = { HAVE_METADATA: 1, HAVE_CURRENT_DATA: 2 };
    const { createNarrationPlayer } = await import("./src/sound/narration-player.ts");
    const player = createNarrationPlayer({ recordings: [
      { cueId: "right", url: "/right.wav", durationSeconds: 30 },
      { cueId: "left", url: "/left.wav", durationSeconds: 30 },
    ] });
    const follow = (offsetSeconds, isPlaying = false, timeScale = 1, cueId = "right") => player.follow({
      position: { cueId, offsetSeconds }, isPlaying, timeScale,
    });
    const clip = clips[0];
    for (let i = 0; i < 600; i++) follow(1.123456789);
    assert.equal(clip.seeks, 0, "metadata must precede seeking");
    clip.readyState = 2;
    for (let i = 0; i < 600; i++) follow(1.123456789);
    assert.equal(clip.seeks, 1, "rounded native getters cannot cause repeated Hold seeks");
    assert.equal(clip.rates, 0, "default playback rate needs no write");
    follow(1.123456790);
    assert.equal(clip.seeks, 2, "even a tiny explicit scrub keeps its exact requested target");
    assert.equal(clip.position, 1.123456790);
    for (let i = 0; i < 600; i++) follow(1.123456790, false, 2);
    assert.equal(clip.rates, 1);
    assert.equal(clip.seeks, 2);

    clip.mode = "pending";
    for (let i = 0; i < 600; i++) follow(1.123456790, true, 2);
    assert.equal(clip.plays, 1, "pending play is one native operation");
    follow(1.123456790, false, 2);
    await Promise.resolve();
    assert.equal(warnings, 0, "a transport-cancelled attempt is not a playback failure");
    clip.mode = "reject";
    follow(1.123456790, true, 2);
    await Promise.resolve();
    for (let i = 0; i < 600; i++) { follow(1.123456790, true, 2); await Promise.resolve(); }
    assert.equal(clip.plays, 2, "rejection must not allocate another promise each frame");
    assert.equal(warnings, 1);
    follow(1.123456790, false, 2);
    clip.mode = "allow";
    follow(1.123456790, true, 2);
    await Promise.resolve();
    assert.equal(clip.plays, 3, "a new transport intent retries playback");
    assert.equal(player.readIsPlaying(), true);
    clip.position = 6;
    follow(3, true, 2);
    assert.equal(clip.position, 3, "ordinary show drift still corrects immediately");
    follow(3.125, false, 2);
    assert.equal(clip.position, 3.125);
    follow(3.125, true, 2);
    await Promise.resolve();
    assert.equal(clip.position, 3.125, "resume keeps the stopped scrub position");

    const natural = (offsetSeconds, isPlaying = true) => player.follow({
      position: { cueId: "right", offsetSeconds }, isPlaying, timeScale: 1,
      preserveNaturalEnd: true,
    });
    clip.position = 29.7;
    const seeksBeforeTail = clip.seeks;
    natural(30.2);
    assert.equal(clip.paused, false, "authored end cannot stop unfinished speech");
    assert.equal(clip.position, 29.7, "clock drift cannot skip the last syllable");
    assert.equal(player.readHasEnded("right"), false);
    natural(30.2, false);
    assert.equal(clip.seeks, seeksBeforeTail, "Hold preserves native speech position");
    natural(30.2);
    await Promise.resolve();
    clip.ended = true; clip.paused = true;
    const playsAtEnd = clip.plays;
    natural(31);
    assert.equal(clip.plays, playsAtEnd, "finished speech is not restarted during breathing space");
    assert.equal(player.readHasEnded("right"), true);
    clip.ended = false;
    natural(4);
    assert.equal(clip.position, 4, "an explicit repeated instruction can still rewind");
    assert.equal(player.readHasEnded("missing"), true);

    clips[1].readyState = 2;
    follow(0, false, 1, "left");
    assert.equal(clip.paused, true);
    assert.equal(clips[1].seeks, 0, "a fresh clip at zero need not seek to zero again");
    clip.mode = "pending";
    follow(4, true);
    player.unload();
    await Promise.resolve();
    assert.equal(warnings, 1, "late unload rejection cannot report a live playback failure");
    assert.ok(clips.every(clip => clip.src === "" && clip.paused));
    const plays = clip.plays;
    follow(4, true);
    assert.equal(clip.plays, plays);
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const error = await new Response(probe.stderr).text();
  expect(error).toBe("");
  expect(await probe.exited).toBe(0);
});
