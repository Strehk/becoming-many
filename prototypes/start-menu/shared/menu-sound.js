/**
 * Purpose: Give the start menu the piece's own sound instead of generic blips.
 * Context: The show plays the drone organ (src/sound/drone-organ): every voice
 *   walks one pentatonic-minor scale on A, inside a nine-second hall. The menu
 *   borrows three of its ideas, with the composed values: the wind that carries
 *   the empty White World, the sonar call that measures a room, and a held
 *   chord in the shared hall.
 * Responsibility: Build the Tone graph after the first gesture, play hover,
 *   select and arrival sounds, and follow the volume setting.
 * Boundary: Nothing in src/ imports this file; it only borrows src/ modules.
 */

import {
  Filter,
  Gain,
  getContext,
  LFO,
  Limiter,
  Noise,
  NoiseSynth,
  now,
  Panner,
  Reverb,
  start,
  Volume,
} from "tone";
import { ORGAN_SCORE } from "../../../src/dramaturgy/organ-score";
import { DRONE_ORGAN_COMPOSITION } from "../../../src/sound/drone-organ/drone-organ-settings";
import { createEchoRoom } from "../../../src/sound/drone-organ/voices/echo-room";
import { createHeldOscillators } from "../../../src/sound/drone-organ/voices/held-oscillators";

const { harmony, room, layers } = DRONE_ORGAN_COMPOSITION;
const layer = (name) => layers.find((entry) => entry.name === name);
const WIND = layer("wind");
const SONAR = layer("sonar");

/** A2 and the composed scale: every menu sound is a degree of it. */
const ROOT_HERTZ = 110;
const degreeHertz = (degree, octave = 0) => {
  const steps = harmony.scaleSemitones;
  const index = ((degree % steps.length) + steps.length) % steps.length;
  const octaves = Math.floor(degree / steps.length) + octave;
  return ROOT_HERTZ * 2 ** ((steps[index] + 12 * octaves) / 12);
};

/**
 * Each control answers on its own scale degree, and its echo stands at its own
 * distance, so moving down the list sounds like sounding out a room.
 */
const HOVER_VOICING = {
  start: { degree: 10, wall: 0.18 },
  settings: { degree: 12, wall: 0.3 },
  credits: { degree: 13, wall: 0.42 },
  desktop: { degree: 11, wall: 0.2 },
  vr: { degree: 13, wall: 0.32 },
  gyro: { degree: 14, wall: 0.44 },
  back: { degree: 8, wall: 0.5 },
  menu: { degree: 8, wall: 0.5 },
  setting: { degree: 15, wall: 0.12 },
};

const decibels = (volume) =>
  volume <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(volume / 100) - 4;

export function createMenuSound(getVolume) {
  let graph;
  let starting;

  function build() {
    const master = new Volume(decibels(getVolume()));
    const limiter = new Limiter(-1);
    master.chain(limiter, getContext().destination);

    // The organ's shared room: the same decay and pre-delay.
    const hall = new Reverb({
      decay: room.decaySeconds,
      preDelay: room.preDelaySeconds,
      wet: 1,
    });
    hall.connect(master);

    // Wind, with the composed band, gust and level at the wind layer's pad.
    const [padX, padY] = WIND.pad;
    const centre = 200 + padX * 2400;
    const noise = new Noise("pink");
    const band = new Filter(centre, "bandpass");
    band.Q.value = 0.3 + WIND.voice.sharpness * 10;
    const gust = new LFO(
      0.02 + WIND.voice.gustRate * 0.9,
      centre * 0.6,
      centre * 1.7,
    );
    gust.connect(band.frequency);
    const windLevel = new Gain(0);
    const windTarget = (0.04 + padY * 0.75) * WIND.volume;
    noise.chain(band, windLevel, master);
    const windSend = new Gain(WIND.roomSend);
    windLevel.connect(windSend);
    windSend.connect(hall);

    // The sonar: the call, its click, and the wall it measures. A hover is a
    // single dry call with one faint return, no hall and no repeats, so one
    // hover never sounds like several.
    const sonarBus = new Gain(SONAR.volume * 1.6);
    sonarBus.connect(master);
    const echo = createEchoRoom(sonarBus, {
      ...SONAR.voice.room,
      delay: 0.2,
      repeats: 0,
      echoMix: SONAR.voice.room.echoMix * 0.22,
      reverbMix: SONAR.voice.room.reverbMix * 0.08,
      roomSize: 0.1,
    });
    const ping = createHeldOscillators({
      type: "triangle",
      polyphony: 4,
      envelope: {
        attack: 0.001,
        attackCurve: "exponential",
        decay: 0.06,
        sustain: 0,
        release: 0.12,
      },
      volumeDecibels: -8,
      pitchDrop: { ratio: 3, seconds: 0.012 },
    });
    ping.output.connect(echo.input);
    const click = new NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.0005, decay: 0.014, sustain: 0 },
      volume: -18,
    });
    const clickBand = new Filter(700 + SONAR.voice.edge * 7000, "bandpass");
    clickBand.Q.value = 1.8;
    click.chain(clickBand, echo.input);

    // Held tones in the hall, for choosing and arriving.
    const chord = createHeldOscillators({
      type: "sine",
      polyphony: 6,
      envelope: { attack: 0.9, decay: 1, sustain: 0.6, release: 5 },
      volumeDecibels: -14,
    });
    chord.output.connect(hall);
    chord.output.connect(master);
    const swell = createHeldOscillators({
      type: "sine",
      polyphony: 3,
      envelope: { attack: 0.25, decay: 0.6, sustain: 0.4, release: 1.6 },
      volumeDecibels: -15,
    });
    // Choosing keeps only a little of the hall.
    const swellSend = new Gain(0.35);
    swell.output.connect(swellSend);
    swellSend.connect(hall);
    swell.output.connect(master);

    // A click that flings particles: a short breath of air opening outward
    // and a scatter of tiny grains flying off to either side.
    const puff = new NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.004, decay: 0.2, sustain: 0 },
      volume: -20,
    });
    const puffBand = new Filter(2200, "bandpass");
    puffBand.Q.value = 0.8;
    puff.chain(puffBand, master);
    const puffSend = new Gain(0.12);
    puffBand.connect(puffSend);
    puffSend.connect(hall);
    const grains = new NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.0004, decay: 0.009, sustain: 0 },
      volume: -21,
    });
    const grainBand = new Filter(5200, "highpass");
    const grainPan = new Panner(0);
    grains.chain(grainBand, grainPan, master);

    return {
      puff,
      puffBand,
      grains,
      grainPan,
      master,
      noise,
      gust,
      windLevel,
      windTarget,
      echo,
      ping,
      click,
      chord,
      swell,
      windOn: false,
    };
  }

  const ensure = () => {
    if (graph) return true;
    if (!starting) {
      starting = start()
        .then(() => {
          graph = build();
        })
        .catch(() => {
          starting = undefined;
        });
    }
    return false;
  };

  const callSeconds = ORGAN_SCORE.pulseSeconds / 8;
  // Tone refuses two starts at the same instant on one voice; a hover and a
  // click in the same moment would otherwise throw.
  let lastStart = 0;
  const startTime = (lead) => {
    lastStart = Math.max(now() + lead, lastStart + 0.012);
    return lastStart;
  };

  return {
    /** Call inside a user gesture; builds the graph once the context runs. */
    unlock() {
      ensure();
    },
    get ready() {
      return Boolean(graph);
    },
    setVolume(volume) {
      if (graph) graph.master.volume.rampTo(decibels(volume), 0.1);
    },
    /** The empty world's wind, fading in as the menu opens. */
    wind(on = true) {
      if (!graph) return;
      if (on && !graph.windOn) {
        graph.noise.start();
        graph.gust.start();
      }
      graph.windOn = on;
      graph.windLevel.gain.rampTo(on ? graph.windTarget : 0, on ? 4 : 1.5);
    },
    /** A dry sonar call on the control's degree; its one return sits at the control's distance. */
    hover(key) {
      if (!graph) return;
      const voicing = HOVER_VOICING[key] ?? HOVER_VOICING.setting;
      const time = startTime(0.01);
      // Close walls only: a late return would read as a second hover.
      graph.echo.setDelay(voicing.wall * 0.3);
      graph.ping.triggerAttackRelease(
        degreeHertz(voicing.degree),
        callSeconds,
        time,
        0.7,
      );
      graph.click.triggerAttackRelease(0.02, time, SONAR.voice.click);
    },
    /** Particles flung from a click: a breath outward and grains flying off. */
    scatter(count = 10) {
      if (!graph) return;
      const time = startTime(0.005);
      graph.puffBand.frequency.cancelScheduledValues(time);
      graph.puffBand.frequency.setValueAtTime(3200, time);
      graph.puffBand.frequency.exponentialRampToValueAtTime(700, time + 0.22);
      graph.puff.triggerAttackRelease(0.05, time, 0.55);
      let at = time + 0.012;
      const grains = Math.min(count, 12);
      for (let n = 0; n < grains; n += 1) {
        at += 0.008 + Math.random() * 0.024;
        graph.grainPan.pan.setValueAtTime(Math.random() * 1.6 - 0.8, at);
        graph.grains.triggerAttackRelease(
          0.006,
          at,
          0.7 * (1 - n / grains) + 0.1,
        );
      }
      lastStart = Math.max(lastStart, at);
    },
    /** Choosing: the call an octave down, and the root and fifth swelling under it. */
    select(key) {
      if (!graph) return;
      const voicing = HOVER_VOICING[key] ?? HOVER_VOICING.setting;
      const time = startTime(0.01);
      graph.ping.triggerAttackRelease(
        degreeHertz(voicing.degree - 5),
        callSeconds,
        time,
        0.8,
      );
      graph.swell.triggerAttackRelease(degreeHertz(0, 1), 0.6, time, 0.5);
      graph.swell.triggerAttackRelease(
        degreeHertz(3, 1),
        0.6,
        time + 0.06,
        0.4,
      );
    },
    /** Arriving: the scale's chord held in the hall, as the title forms. */
    arrive() {
      if (!graph) return;
      const time = startTime(0.02);
      [0, 2, 3, 4].forEach((degree, index) => {
        graph.chord.triggerAttackRelease(
          degreeHertz(degree, 2),
          2.4,
          time + index * 0.09,
          0.42,
        );
      });
      graph.chord.triggerAttackRelease(degreeHertz(0, 1), 3, time, 0.5);
    },
  };
}
