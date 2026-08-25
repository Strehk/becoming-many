# Level Guide

The narrative levels in **Becoming Many** are continuous world states, not separate scenes. This guide keeps the implemented source preset separate from the planned narrative sequence.

## Current Source Preset

Three sparse presets currently exist under `src/levels`:

- `white-world.level.ts` defines the narrative White World without Terrain.
- `test.level.ts` is the diagnostic development preset and adds Terrain plus the
  Zone Visualizer for landscape work.
- `designTest.level.ts` is the active visual-design preset and adds authored
  semantic colors to the landscape modules.

The White World and Test presets use these presentation values:

- white background (`0xffffff`)
- point size `0.075`
- horizontal and vertical drift amplitudes of `0.12` and `0.24` metres

Their current capacity differs deliberately:

- White World uses a 128-metre view distance and 192 particles per volume.
- Test Level uses a 180-metre view distance and 80 particles per volume.
- Design Test uses a 180-metre view distance and 80 particles per volume.

The Test and Design Test presets additionally activate:

- generated Terrain with one continuous carved river
- deterministic water, meadow, forest, and shrub-slope zones
- one distinct diagnostic color for every zone
- zone-driven trees, bushes, and rocks
- Deer, Stag, Fox, and Rat with a four-actor visibility budget
- level-authored grass height and density for meadow and shrub-slope zones
- level-authored Vegetation and Rock instances per hectare for each land zone

Test uses the Zone Visualizer and Magnetic Sense for diagnostics. Design Test
uses authored semantic colors instead.

The level does not contain asset URLs, model names, seeds, candidate spacing,
or weighted variants. Those stable content definitions belong to the concrete
modules and load only when their module is enabled.

The current runtime adds no fog, lights, audio, or state transition to this
level. Vegetation, Rocks, and Animals are development modules in Test Level;
they remain absent from White World.

## Planned Shared Rules

- The user keeps the same world position and flight state through narrative levels 01–07.
- The terrain and world coordinates remain continuous.
- Each level is a typed preset that changes base parameters and module configurations.
- Compatible states may overlap during transitions.
- Upcoming modules prefetch and load before they become visible.
- Finished modules deactivate, unload, and release all owned resources.
- The audio clock drives narrative cues; the operator controls entry into and exit from VR.
- Every level must pass its standalone PICO performance gate before integration.

## Moodboards and Palettes

These moodboards interpret this guide. If an image conflicts with a level description, the written level description is authoritative.

The images were created for this project with OpenAI Image Gen on 2026-08-21. Two watercolor sheets supplied by the project owner were used only as medium and layout references.

| Level | Moodboard | Palette |
|---|---|---|
| 00 — Test Level | Not added | `#F7EEE4` `#DFE4E5` `#BEC7CB` `#AEC8C5` `#354B63` `#F1B464` |
| 01 — White World | [View](01-white-world/mood/moodboard.png) | `#F8F2E8` `#F4F0ED` `#EAEAEA` `#E4DFE0` `#E3DCE0` `#E4E0DC` |
| 02 — Scent World | [View](02-scent-world/mood/moodboard.png) | `#F6EEE0` `#B8E0E1` `#9DD2C8` `#D1C1D7` `#FDA39D` `#FDBB54` |
| 03 — Echolocation | [View](03-echolocation/mood/moodboard.png) | `#0E1017` `#0D1730` `#3C4782` `#3FA7E2` `#CBD9E5` `#F6F0E9` |
| 04 — Motion Perception | [View](04-motion-perception/mood/moodboard.png) | `#212133` `#312758` `#45577A` `#10BEDB` `#E3DFDD` `#F3952D` |
| 05 — Thermal Perception | [View](05-thermal-perception/mood/moodboard.png) | `#2E1386` `#0C47D1` `#2EB4E8` `#D5198A` `#FB5F16` `#FCCE43` |
| 06 — Magnetic Field Perception | [View](06-magnetic-field-perception/mood/moodboard.png) | `#151935` `#1140A4` `#69BDE1` `#CDDBE2` `#A394C3` `#F9B33C` |
| 07 — Connections | [View](07-connections/mood/moodboard.png) | `#F2E3D3` `#683B5A` `#292E55` `#A5BDC3` `#D06780` `#E39E54` |

## Planned Level Specifications

## 00 — Test Level

### Intent

Teach the user how to fly with ICAROS before the narrative experience begins.

### Visual Direction

- A simple, calm training space with clear orientation and scale cues.
- Only elements needed to understand movement and control are visible.
- Feedback remains environmental and avoids a complex interface.

### Modules

- training environment
- flight input
- minimal orientation cues

### Transition

The operator enters the Test Level from passthrough and advances to White World when training is complete. Whether flight position and velocity carry into White World remains an open experience decision.

### Performance Direction

Keep this state minimal so input behavior and motion comfort can be assessed without unrelated rendering load.

### Open Art Decisions

- training tasks and completion criteria
- training environment and orientation cues
- transition behavior into White World
- final ICAROS input mapping

## 01 — White World

### Intent

Begin the narrative in an almost entirely white world. This first state establishes openness, atmosphere, and the sensation of air while offering almost no recognizable spatial structure.

### Visual Direction

- A bright, low-contrast world dominated by white and neutral tones.
- Terrain appears as soft silhouettes inside atmospheric depth.
- Fog hides the streaming boundary and reduces distant detail.
- Minimal air particles provide motion and depth cues.
- Vegetation remains absent or extremely restrained.

### Modules

- lighting
- fog
- minimal air particles
- terrain

### Transition

The operator advances from the Test Level. White World establishes the narrative baseline before the transition into Scent introduces color and floating scent signals without changing the flight path.

### Performance Direction

This is the baseline state. It should use the lowest practical geometry and shader cost while prewarming the first visible modules.

### Open Art Decisions

- exact white palette and contrast range
- fog model and visibility distance
- amount of visible terrain detail
- onboarding and transition duration

## 02 — Scent World

### Intent

Make scent spatially visible without revealing its sources. Distinct floating scent clouds form a coarse spatial map through color, motion, density, and particle behavior.

### Visual Direction

- Color enters the previously neutral world through scent signatures.
- Only scent points and diffuse scent clouds are visible.
- Plants, animals, terrain, and all other source objects remain invisible.
- Clouds originate from deterministic spatial anchors and move through the shared wind field.
- Source families use a coherent palette with clearly distinguishable signatures.

### Modules

- scent fields
- scent particles
- wind

### Transition

Scent fields load before their opacity rises. During the transition to Echolocation, scent particles fade and unload while world position remains stable.

### Performance Direction

Particles use fixed-capacity GPU buffers and as few draw calls as possible. Density is limited by transparent overdraw, not only by particle count.

### Open Art Decisions

- scent palette and source-to-color mapping
- particle shape, scale, lifetime, and flow
- scent-cloud scale, density, and overlap
- whether scent reacts to flight proximity

## 03 — Echolocation

### Intent

Add clearly perceptible depth through distance-dependent visibility. The result of echolocation is shown directly; individual visible echo waves are explicitly excluded.

### Visual Direction

- The base world becomes dark or visually reduced.
- Terrain and vegetation emerge through depth-dependent visibility.
- Distance determines how terrain, vegetation, and objects are represented.
- Existing geometry changes appearance through shared materials and uniforms.
- Depth cues must remain comfortable during fast flight.

### Modules

- terrain
- required vegetation silhouettes
- depth perception

### Transition

Color and scent recede while depth response becomes dominant. Motion cues may begin during the exit so moving plants and animals lead naturally into the next state.

### Performance Direction

Prefer material changes over duplicate geometry or additional scene passes. A post-processing solution is allowed only if measurement proves it affordable on PICO.

### Open Art Decisions

- exact depth-map appearance and distance mapping
- depth falloff and silhouette treatment
- background and highlight colors

## 04 — Motion Perception

### Intent

Inspired by frogs and motion-sensitive insects, make movement the primary way the world becomes visible. Static elements largely disappear while moving forms remain as fleeting silhouettes.

### Visual Direction

- Moving animals and vegetation receive the strongest visibility.
- Static elements recede without removing spatial orientation completely.
- Moving forms appear as silhouettes, temporary contours, or afterimages.
- Shared wind motion connects grass, bushes, and trees.
- Animal movement remains sparse and readable.
- Visibility responds smoothly and avoids flicker at motion thresholds.

### Modules

- motion perception
- animals
- grass, bushes, and trees as required
- shared wind

### Transition

Depth-driven visibility yields to motion-driven visibility. Thermal values can appear first on moving animals before spreading to terrain and vegetation.

### Performance Direction

Motion must be derived from shared shader values or compact instance data. Avoid per-object frame updates and large active animal populations.

### Open Art Decisions

- whether user motion, world motion, or both control visibility
- how long motion remains visible
- animal species and movement style
- balance between wind motion and animal motion

## 05 — Thermal Perception

### Intent

Inspired by snakes, reveal the world through temperature differences. Living and non-living structures become distinguishable, with warm animals appearing prominently like prey.

### Visual Direction

- A controlled false-color palette replaces normal surface color.
- Animals provide strong, localized heat signatures.
- Terrain carries broad cool and warm gradients.
- Vegetation receives stable temperature variation from world fields.
- Thermal boundaries blend continuously across the landscape.

### Modules

- thermal perception
- animals
- terrain
- required vegetation

### Transition

Thermal values first attach to moving forms, then become the dominant world representation. They later fade as large-scale directional magnetic patterns become visible.

### Performance Direction

Reuse existing geometry. Compute thermal color through shared uniforms, procedural fields, and compact instance attributes without an additional thermal camera or duplicate render pass.

### Open Art Decisions

- physical versus expressive temperature mapping
- thermal palette
- temporal variation and heat trails
- relationship between altitude, ground type, and temperature

## 06 — Magnetic Field Perception

### Intent

Inspired by migratory birds, expose a stable field direction that exists independently of gaze and flight path. Magnetic lines run through the ground; a later sky element may reinforce the same direction.

### Visual Direction

- Transparent field lines remain anchored in the ground and follow the terrain.
- Narrow light pulses inside those lines make the field direction readable.
- The selected ground presentation remains visible between and below the lines.
- A later sky element may add a long-distance orientation cue.
- The representation stays coherent across long flights and floating-origin shifts.
- Earlier thermal color reduces so the magnetic signal remains legible.

### Modules

- magnetic sense
- terrain
- optional sky cue

### Transition

Thermal contrast fades while the ground field establishes global orientation. It recedes as local relationships and networks become visible in the final state.

### Performance Direction

Reuse Terrain's existing material pass. Keep lines analytical and opaque; avoid line geometry, transparent overlays, physical lights, bloom, and extra render passes.

### Open Art Decisions

- final line opacity, pulse width, and flow timing
- optional sky form and its relationship to the ground field
- color and brightness hierarchy
- relationship between flight direction and perceived orientation

## 07 — Connections

### Intent

Add no further biological sense. Instead, reveal relationships within the already perceived world so individual elements become parts of a larger connected system.

### Visual Direction

- Mycelium and root structures connect visible resources in the landscape.
- Connections emerge from the same deterministic world positions as their sources.
- Layer opacity may reveal structures below the terrain.
- Earlier perception languages may return selectively as a final synthesis.
- The network remains local and streamed rather than generating an unlimited global graph.

### Modules

- mycelium and roots
- world connections
- required terrain, vegetation, and animals
- selected earlier perception modules

### Transition

The magnetic field resolves into local relationships and network flow. At the end, modules fade and unload in a controlled sequence before the operator returns the presentation to passthrough.

### Performance Direction

Use bounded, pooled network geometry tied to the active world window. Generate topology outside the frame hot path and avoid one scene object per connection.

### Open Art Decisions

- which world elements participate in the network
- visible depth and terrain transparency
- network growth, pulse, and reinforcement behavior
- which earlier visual languages return in the final synthesis
- final audio and offboarding transition

## Level Folders

Active art direction is stored beside each level:

```text
docs/levels/
├── README.md
├── 01-white-world/mood/moodboard.png
├── 02-scent-world/mood/moodboard.png
├── 03-echolocation/mood/moodboard.png
├── 04-motion-perception/mood/moodboard.png
├── 05-thermal-perception/mood/moodboard.png
├── 06-magnetic-field-perception/mood/moodboard.png
└── 07-connections/mood/moodboard.png
```

Each level `README.md` should contain:

- narrative intent and experience goal
- entry, exit, and timeline cues
- visual and audio direction
- exact typed preset and active modules
- asset and shader requirements
- performance budget and measured evidence
- decisions, risks, and open questions

Store mood images in the level's `mood/` folder. Record source, creator, license, and intended influence beside every external reference.
