<!--
Purpose: Track diagnosis and hardening of the black screen during PCVR session startup.
Context: A second Windows station enters an immersive browser session but the PICO display remains black.
Responsibility: Define the evidence, minimal diagnostics, and recovery tests required for safe operation.
Boundary: This task does not redesign rendering, add a logging framework, or accept performance without physical PCVR evidence.
-->

# Diagnose and Harden PCVR Session Startup

**Status:** Open
**Priority:** Installation blocker
**Reported:** 2026-09-02
**Issue:** [#42](https://github.com/Strehk/becoming-many/issues/42)

## Observed Failure

On another Windows PC, PICO Business Streaming and SteamVR reach the empty VR
room. When the browser application takes over, the headset shows only black.
Closing the browser returns the headset to the empty SteamVR room.

This does not yet prove that SteamVR crashes. The observed hand-back suggests
that SteamVR remains alive while the browser owns an immersive WebXR session
that submits no usable frames. The exact browser error, WebGL state, active
OpenXR runtime, GPU, driver, and streaming logs have not yet been captured, so
the root cause remains unconfirmed.

## Initial Diagnosis

Investigate these hypotheses in order:

1. **Station GPU or driver mismatch.** PICO Business Streaming requires a
   VR-ready dedicated GPU with supported H.264 or H.265 encoding. Integrated
   Intel GPUs and several AMD models are explicitly unsupported. On a hybrid
   graphics PC, Chrome may also run on the integrated GPU while SteamVR and
   Business Streaming run on the dedicated GPU.
2. **Wrong OpenXR runtime or streaming mode.** Chromium uses OpenXR for WebXR
   on Windows. The selected delivery path requires the browser to reach the
   active SteamVR runtime while PICO Business Streaming is in wired SteamVR
   mode. A competing OpenXR runtime can make session creation or presentation
   fail.
3. **WebXR session setup rejection.** Three.js must make the existing WebGL
   context XR-compatible, create the XR layer, and obtain a reference space.
   A rejection in this sequence currently appears only as a browser promise
   error and is not surfaced by the application.
4. **WebGL context loss or station overload.** The default page preloads and
   allocates the complete show composition. The project has no accepted PCVR
   performance result, and historical desktop evidence already exceeds the
   90 Hz frame budget. Stereo rendering or XR layer allocation may expose a
   GPU memory, driver, or workload failure that desktop rendering does not.
5. **Wrong origin.** WebXR requires a secure context. The station application
   must run from `http://localhost`, not a plain LAN-IP origin. This is less
   likely if the browser successfully offers and enters immersive VR.

The current WebXR structure itself follows the documented Three.js pattern:
one `WebGLRenderer`, `renderer.xr.enabled = true`, `VRButton`, and one
`renderer.setAnimationLoop()`. There is no source-level proof yet that this
pattern is the failing component.

## Evidence Already Collected

- A headed desktop Chromium smoke test on 2026-09-02 loaded
  `?level=white-world` with a canvas, white background, and no runtime or shader
  errors. This is desktop evidence only and does not validate WebXR or Windows.
- The bare show route repeatedly reports failed `ws://localhost:7823` station
  connections when the optional broker is absent. These failures do not explain
  the black XR display, but they make the browser console noisy and can hide the
  first relevant XR or WebGL error.
- The application has no bounded listener for XR session events, WebGL context
  loss, global errors, or unhandled promise rejections.
- The repository has no verified Windows station launcher and no recorded
  end-to-end wired PCVR acceptance run.

## Reproduction and Isolation

Use one pinned station configuration and keep Chrome DevTools open with
**Preserve log** enabled. Record the result of every step before changing the
runtime, driver, resolution, or application settings.

1. Record the build commit and working tree:

   ```powershell
   git rev-parse HEAD
   git status --short --branch
   ```

2. Record Windows, Chrome, SteamVR, PICO Business Streaming, headset/PICO OS,
   GPU, driver, USB cable, and USB port versions. Save `chrome://gpu`, including
   `GL_RENDERER` and Graphics Feature Status.
3. Confirm that the empty SteamVR room remains stable without the browser.
4. Run an official minimal Three.js WebXR example. If it also becomes black,
   stop application debugging and repair the station runtime/GPU path first.
5. Run `http://localhost:<port>/?level=white-world`. This avoids GLB assets,
   the show composition, and the station connection.
6. If White World works, test `scent`, `echo`, `motion`, `thermal`, `magnetic`,
   and `connections` in that order. The first failing level owns the next
   investigation boundary.
7. Test the bare show route only after the isolated levels are understood.

Capture the first occurrence of any of the following:

- `Uncaught (in promise)`
- `makeXRCompatible`
- `XRWebGLLayer` or `createProjectionLayer`
- `requestReferenceSpace`
- `WebGL context lost`
- `THREE.WebGLProgram: Shader Error`
- `GL_INVALID_*`

Export the PICO Business Streaming PC and headset logs while the headset remains
connected over USB. Also save a SteamVR system report. Do not diagnose from a
photograph of the black display alone.

## Smallest YAGNI Solution

First fix the confirmed station or application fault. Do not lower quality,
replace the renderer, add fallback runtimes, or introduce an adaptive quality
system before the isolation sequence identifies the failing boundary.

If the existing external logs do not expose the fault, add one opt-in
`?diagnostics=1` feature at the VR entry and the existing renderer owner:

- record `sessionstart` and `sessionend` from `renderer.xr`;
- record `error` and `unhandledrejection` from `window`;
- record `webglcontextcreationerror`, `webglcontextlost`, and
  `webglcontextrestored` from the renderer canvas;
- capture shader compile/link failures through the existing renderer debug API;
- report the URL, secure-context state, Three.js revision, user agent, active
  WebGL renderer, context attributes, capabilities, and first submitted frame;
- keep a bounded in-memory event list and provide one copyable report on the
  Windows monitor;
- return one idempotent `unload()` that removes every listener and restores any
  renderer callback it changed.

Read graphics facts from the existing renderer. Do not create another WebGL
context, replace global console methods, add a telemetry service, write an
unbounded log, include Wi-Fi credentials or other secrets, or leave diagnostics
enabled in the audience path.

## Affected Files

- `src/world/webxr-entry.ts`
- `src/world/world-runtime.ts`
- `src/world/world-settings.ts`
- `src/main.ts` until the planned `/vr/` entry exists
- `src/levels/level-runtime.ts`
- Focused diagnostics tests under `tests/world/` or the future VR-entry tests
- `docs/platforms.md`
- `docs/direction/headset.md`
- `docs/performance.md`

Coordinate the final diagnostics entry point with
`isolate-vr-test-conductor-entries.md`; do not reorganize the entry files twice.

## Automated Verification

- Prove that diagnostics disabled creates no DOM, listeners, timers, renderer
  callbacks, per-frame allocations, or additional WebGL context.
- Prove the event buffer is bounded and preserves the first fatal error.
- Prove duplicate `unload()` calls are safe and remove all owned listeners.
- Prove error and rejection values are serialized without throwing and without
  recording sensitive URL data.
- In a dedicated browser test, simulate WebGL context loss and restoration and
  verify that both events enter the report. Never run this fault injection in
  the audience application.
- Run `bun test`, `bun run check`, `bun run lint`, `bun run build`, and `fallow`.

Headless or desktop tests do not complete this task.

## Physical Safe-Operation Verification

On the pinned wired Windows-PC/SteamVR/PICO station:

1. Enter and exit immersive VR ten times without a black display, leaked
   session, browser restart, or manual process termination.
2. Reload and restart the browser, then verify that the next session starts
   cleanly.
3. Disconnect and reconnect the USB cable and verify a documented recovery
   path back to the SteamVR room and then the experience.
4. Restart SteamVR and PICO Business Streaming independently and verify that
   the operator can recover without rebooting the whole station.
5. Power-cycle the headset and verify connection, session start, tracking,
   rendering, and audio.
6. Run the complete show and record application frame timing together with
   Business Streaming render, encode, transport, decode, latency, and
   interpolation data.
7. Complete the existing two-hour station soak with repeated session cycles and
   no growing renderer resources, listener duplication, unrecoverable black
   display, or manual repair outside the documented procedure.

Every result must name the build revision and full hardware/software matrix.
The run must meet the repository's physical performance gate; a merely visible
image is not acceptance.

## Completion Criteria

- The black-screen root cause is confirmed by an exact browser, PICO, SteamVR,
  driver, or application error rather than inferred from the symptom.
- The confirmed fault is fixed at its owning boundary and has the narrowest
  practical regression test.
- Opt-in diagnostics, if needed, are bounded, removable, and have no audience
  path overhead when disabled.
- The minimal official example, White World, every cumulative level, and the
  complete show start and exit successfully on the pinned station.
- Safe restart, USB reconnect, runtime restart, headset power-cycle, repeated
  entry/exit, and soak procedures pass and are recorded.

## Primary Sources

- [PICO Business Streaming 2.1/2.2 documentation](https://business.picoxr.com/de/doc/43j3qcoq)
- [Chromium Windows WebXR/OpenXR architecture](https://chromium.googlesource.com/chromium/src/+/main/device/vr/README.md)
- [Three.js WebXRManager](https://threejs.org/docs/pages/WebXRManager.html)
- [Three.js WebGLRenderer diagnostics](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Three.js VR content workflow](https://threejs.org/manual/en/how-to-create-vr-content.html)
