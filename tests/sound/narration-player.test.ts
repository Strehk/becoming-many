import { expect, test } from "bun:test";

test("language replacement keeps the audible source until ready and discards obsolete intent", async () => {
  const probe = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import assert from "node:assert/strict";
    const media = [];
    class Audio {
      currentTime = 0; playbackRate = 1; paused = true; ended = false;
      readyState = 0; seeking = false; muted = false; error = null;
      plays = 0; pauses = 0; nextPlay = () => Promise.resolve();
      constructor(src) { this.src = src; media.push(this); }
      play() { this.plays++; this.paused = false; return this.nextPlay(); }
      pause() { this.pauses++; this.paused = true; }
      removeAttribute() { this.src = ""; }
      load() {}
    }
    globalThis.Audio = Audio;
    globalThis.HTMLMediaElement = { HAVE_METADATA: 1, HAVE_CURRENT_DATA: 2 };
    const { createNarrationPlayer } = await import("./src/sound/narration-player.ts");
    const recordings = language => [{ cueId: "opening", url: "/" + language + ".wav", durationSeconds: 30 }];
    const player = createNarrationPlayer({ recordings: recordings("en") });
    const follow = (seconds, playing = true) => player.follow({
      position: { cueId: "opening", offsetSeconds: seconds }, isPlaying: playing, timeScale: 1,
    });
    const english = media[0]; english.readyState = 4;
    follow(4); await Promise.resolve();
    const pauses = english.pauses;
    player.setRecordings(recordings("de"));
    const german = media.at(-1);
    assert.equal(english.pauses, pauses, "selecting language must not pause the current source");
    follow(5);
    assert.equal(player.readIsPlaying(), true);
    assert.equal(player.readOffsetSeconds("opening"), 5);
    assert.equal(german.muted, true, "candidate must stay silent while pending");
    await Promise.resolve();
    german.readyState = 4; german.seeking = true;
    follow(6);
    assert.equal(english.paused, false, "metadata alone cannot end the current source");
    german.seeking = false;
    follow(6);
    assert.equal(english.src, "");
    assert.equal(german.muted, false);
    assert.equal(player.readOffsetSeconds("opening"), 6);

    player.setRecordings(recordings("en"));
    const obsolete = media.at(-1);
    let resolvePlay;
    obsolete.nextPlay = () => new Promise(resolve => { resolvePlay = resolve; });
    follow(7);
    player.setRecordings(recordings("de"));
    resolvePlay(); await Promise.resolve(); follow(8);
    assert.equal(obsolete.src, "");
    assert.equal(obsolete.paused, true);
    assert.equal(german.paused, false);
    assert.equal(media.at(-1), obsolete, "returning to the active language reuses its media");

    player.setRecordings(recordings("en"));
    const held = media.at(-1); held.readyState = 4;
    follow(8, false);
    assert.equal(held.paused, true);
    assert.equal(held.currentTime, 8);
    assert.equal(held.plays, 0, "a held language switch must not start audio");
    assert.equal(german.src, "");
    follow(8); await Promise.resolve();
    player.setRecordings(recordings("de"));
    const failed = media.at(-1); failed.readyState = 4;
    failed.nextPlay = () => Promise.reject(new Error("unavailable"));
    console.warn = () => {};
    follow(9); await Promise.resolve(); follow(10);
    assert.equal(held.paused, false, "a failed replacement cannot stop existing speech");
    assert.equal(player.readIsPlaying(), true);
    assert.equal(player.readHasEnded("opening"), false);
    follow(10, false);
    failed.nextPlay = () => Promise.resolve();
    follow(10); await Promise.resolve(); follow(11);
    assert.equal(failed.muted, false);

    player.setRecordings(recordings("en"));
    const cancelled = media.at(-1);
    cancelled.nextPlay = () => new Promise(resolve => { resolvePlay = resolve; });
    follow(12);
    player.unload(); resolvePlay(); await Promise.resolve();
    assert.ok(media.every(clip => clip.src === "" && clip.paused));
    assert.equal(player.readIsPlaying(), false);

    const unequal = createNarrationPlayer({ recordings: [{
      cueId: "opening", url: "/short.wav", durationSeconds: 10,
    }] });
    const short = media.at(-1); short.readyState = 4;
    const advance = seconds => unequal.follow({
      position: { cueId: "opening", offsetSeconds: seconds }, isPlaying: true, timeScale: 1,
    });
    advance(9); await Promise.resolve();
    unequal.setRecordings([{ cueId: "opening", url: "/long.wav", durationSeconds: 15 }]);
    short.currentTime = 10; short.ended = short.paused = true;
    const playsAtEnd = short.plays;
    advance(11); advance(12);
    assert.equal(short.plays, playsAtEnd, "a shorter retained recording cannot restart after its natural end");
    assert.equal(short.currentTime, 10, "a retained source cannot be sought beyond its own duration");
    unequal.unload();

    const slow = createNarrationPlayer({ recordings: recordings("en") });
    const original = media.at(-1); original.readyState = 4;
    const tick = seconds => slow.follow({
      position: { cueId: "opening", offsetSeconds: seconds }, isPlaying: true, timeScale: 1,
    });
    tick(3); await Promise.resolve();
    slow.setRecordings(recordings("de"));
    const candidate = media.at(-1); candidate.readyState = 4;
    let position = 0, seeks = 0, remainingSeekFrames = 0;
    Object.defineProperty(candidate, "currentTime", {
      get: () => position,
      set: seconds => { position = seconds; seeks++; remainingSeekFrames = 4; candidate.seeking = true; },
    });
    for (let frame = 0; frame < 10; frame++) {
      if (remainingSeekFrames && --remainingSeekFrames === 0) candidate.seeking = false;
      if (!candidate.seeking && !candidate.paused) position += 0.1;
      original.currentTime = 3 + frame * 0.1;
      tick(3 + frame * 0.1);
      await Promise.resolve();
      if (!candidate.muted) break;
    }
    assert.ok(seeks <= 2, "400ms native seeks cannot be restarted by frame drift correction");
    assert.equal(candidate.muted, false, "bounded preparation eventually promotes the replacement");
    assert.equal(original.src, "");
    slow.unload();
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await new Response(probe.stderr).text()).toBe("");
  expect(await probe.exited).toBe(0);
});

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

    const coldPlayer = createNarrationPlayer({ recordings: [
      { cueId: "retry", url: "/retry.wav", durationSeconds: 30 },
    ] });
    const coldClip = clips.at(-1);
    const coldFollow = offsetSeconds => coldPlayer.follow({
      position: { cueId: "retry", offsetSeconds }, isPlaying: true,
      timeScale: 1, preserveNaturalEnd: true,
    });
    coldFollow(19.3);
    assert.equal(coldClip.seeks, 0);
    coldClip.readyState = 2;
    coldFollow(19.4);
    assert.equal(coldClip.position, 19.3, "metadata arrival applies the retained instruction start");
    coldFollow(20);
    assert.equal(coldClip.seeks, 1, "natural playback does not become drift seeking");
    coldPlayer.unload();
  `,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const error = await new Response(probe.stderr).text();
  expect(error).toBe("");
  expect(await probe.exited).toBe(0);
});
