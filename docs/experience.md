# Experience

## Core Experience

**Becoming Many** is one continuous narrative flight through a procedurally streamed world. The user keeps their position while the world changes around them. Narrative world states are not separate scenes or traditional levels. A Test Level will precede them to teach ICAROS flight.

In the complete experience, flight does not control narrative time. The audio
timeline controls state changes and transitions.

## Current Playable Slice

The current application starts with the visual-design preset in
`designTest.level.ts`. It provides a pale blue background, authored module
colors, streamed Air Particles, generated Terrain, desktop flight, and
user-triggered `immersive-vr` entry. The complete Test Level training flow,
audio timeline, state transitions, operator controls, and passthrough flow do
not exist yet.

## Target Presentation Flow

1. Start in passthrough so the headset can be fitted safely.
2. The operator enters the Test Level through a shared presentation contract.
3. The user learns the ICAROS flight controls in opaque VR.
4. The operator starts the narrative experience in White World.
5. The user flies continuously while narrative world states change.
6. The operator starts offboarding through the same presentation contract.
7. The virtual world fades out and passthrough returns.

The operator is the first presentation-control source. The contract must allow a different source later.

## Planned World States

| State | Inspiration | Focus | Main modules |
| --- | --- | --- | --- |
| 00 — Test Level | Flight training | Learn ICAROS flight before the narrative experience | Training environment, flight input |
| 01 — White World | Initial state | Atmosphere and openness | Light, fog, minimal air particles |
| 02 — Scent World | Smell | Colored scent signatures | Scent fields, plants, scent particles |
| 03 — Echolocation | Bat | Depth-dependent visibility | Terrain, vegetation, depth |
| 04 — Motion Perception | Frog and insects | Visibility through movement | Animals, plant motion, motion |
| 05 — Thermal Perception | Snake | Temperature contrast | Animals, ground, vegetation, thermal |
| 06 — Magnetic Field Perception | Migratory birds | Ground field lines and persistent north orientation | Terrain, magnetic sense, optional sky cue |
| 07 — Connections | Relationships and networks | Visible relationships | Roots, mycelium, world connections |

Transitions between narrative states must blend compatible states without teleporting the user or rebuilding the complete world. Whether the Test Level resets position or velocity before White World remains open.

See the [Level Guide](levels/README.md) for the current detailed direction of each state.

## Audio Direction

The likely baseline is one continuous master audio file. Its exact structure is still open.

The audio clock is authoritative for narrative cues. Spatial and granular layers may be added, but they must remain synchronized with the master clock and use bounded voice pools.

## Input

Development flight currently uses pointer-lock mouse look and WASD or arrow-key
flight through 3D space. Forward and backward movement follow the mouse look
direction and move the Three.js camera directly.

The next navigation layer will normalize input before producing position,
orientation, and velocity. A later ICAROS adapter will use that same narrow
contract without changing world modules. The Test Level will teach the final
ICAROS controls before the narrative experience begins.
