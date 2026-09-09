# Tutorial scene script

This script connects the installed German recordings, participant action and
procedural scene staging. It interprets the approved content; it does not replace
the narration, add a cinematic timeline or prescribe automatic flight. Scene
images are independent concept illustrations, **not runtime screenshots**, scale
drawings, particle budgets or an additional rendering specification.

The recording bytes and durations are recorded in
[audio provenance](../../public/audio/tutorial/provenance.json). The complete
line-by-line English gloss and alignment evidence live in
[spoken-line staging](../evidence/issue-50/README.md#spoken-line-staging--2026-09-09).
Word boundaries are locally estimated; precise listening approval remains open.
The authored runtime values live in
[the Start recipe](../../src/levels/start.level.ts), not in this document.

## Timing and interaction contract

Times below are **local to the selected native recording**, not deadlines for
the participant. Show gates presentation against the lesser of the requested
cue offset and observed native media offset. A delayed recording must not be
preceded by its arrow. Show remains the only time authority. Existing practice
speed is 2 m/s; steering, climb and head tracking retain their current owners.

Integrated practice lasts up to 60 playing seconds, including the opening.
Four counted passages before that cutoff earn the entire 13.861479-second
closing, allowing approximately 74 seconds in total. Otherwise practice ends
without false success speech. The prepared UI can enter the experience directly.
Pause freezes flight, practice time and formation/retirement. Standalone Start
remains independently exercisable without a prepared main handoff. English
recordings and fallback policy are still open; no translation or fallback is
introduced here.

Each movement lesson follows the same causal sequence:

1. The explicit spoken instruction releases one prominent particle arrow.
2. The arrow forms over two playing seconds at a fixed, discoverable world pose.
   Its tip points at a reserved tunnel entrance, whose opening faces that axis.
   Its direction announces a gentle reachable bend ahead. The participant has
   room to lean and turn before reaching it; no steering is applied for them.
3. Only a sustained actual movement change in the requested direction releases
   the assisting rings. A head turn alone does not satisfy this condition.
4. Separate local particle clouds gather into ring bodies along the short
   guidance curve. The arrow stays intact. Openings are perpendicular to local
   tangents, with smooth orientation and spacing along curve length.
5. Three preview rings assist passage; only the final tutorial goal advances
   the lesson. Swept crossings work between frames and count at most once.
6. A passed ring gives a brief local silver/turquoise response and organic
   dispersal. A miss produces no success response and leaves the lesson open.

Displayed objects never chase the viewer or a recalculated forecast. New,
unshown sections may use current world motion and a gentle lesson bias; future
uncertainty is distinct from the existing controls' reachable yaw/climb limits.
A failed section may retire instead of forcing a sharp connection. Head pose
serves discovery and visibility, not the motion forecast.

## Scene 01 — A space becomes possible

![Concept: the room gradually emerges](tutorial-storyboard/scene-01.png)

**Audio:** `introduction-right.wav`, total 20.725729 s. From its opening through
the questions about a beginning, the participant and a narrator, the world stays
empty white. No person or narrator avatar is invented. At **13.12 s**, within the
room phrase at 12.32–15.44 s, the ambient particle space begins its two-second
reveal. At 16.30–18.46 s, the invitation to check the room retains that space
without arrow or ring.

**World and action:** This is orientation, not a hidden gesture test. Fine grains
are distributed around the moving participant through world-anchored chunks.
Soft cloud volumes can enrich depth while leaving a high proportion of white
space and a clear near field. Slow correlated drift should imply air rather
than flashing noise. No camera-attached cloud wall or forced gaze is introduced.

**Sound:** The existing quiet organ wind follows room presence, with further
attenuation during speech. Object sounds remain inactive until their objects
appear. A rising wind must not mask the first movement call.

## Scene 02 — Follow the first rightward invitation

![Concept: a rightward arrow announces an open bend](tutorial-storyboard/scene-02.png)

**Audio:** The same introduction releases the right arrow at **19.30 s**, the
explicit rightward lean call at 19.30–20.10 s. No arrow appears at the earlier
sentence about checking the room.

**World and action:** A substantial neutral arrow with a slight warm accent
forms in the forward discoverable region. It should point along the offered
rightward bend toward the future passage, not read as an unrelated flat icon.
Its tip and body remain clear of the passage. After it is fully formed, actual
rightward flight movement confirms the turn; then separate particle clouds
gather into the right-curving tunnel ahead. The participant follows the cue
with their own movement. Neither seeing a ring nor leaning without passage
earns the goal.

**Sound and response:** The arrow's atmosphere is located at its fixed world
pose. The forming tunnel supplies separate local granular sources, so distance
and side are audible. An optional quiet formation swell describes ring birth;
one short local passage sound accompanies earned feedback rather than playing
continuously. Speech remains dominant. A ring does not inherit the arrow's
particle cloud or teleport its sounding source.

## Scene 03 — Turn to the other side

![Concept: a leftward invitation leads into a separate tunnel](tutorial-storyboard/scene-03.png)

**Audio:** `left.wav`, total 2.735417 s. Praise at 0.00–0.52 s does not spawn
an arrow. The explicit other-side call at **1.14 s** releases the left cue.

**World and action:** The next reachable segment is planned from the actual
flight motion after the right passage. It suggests a gentle left bend rather
than demanding an immediate reversal. The new arrow is world-fixed; a preceding
arrow may remain behind or to the side while its lifetime runs out. Only after
leftward motion is established do rings gather along that lesson's curve.
Arc-length spacing makes the three previews read as a tunnel with a clear end.

**Sound and response:** Ring grain source and offset vary within the loaded
pool for this activation; Pause retains that selection. This variety changes
texture, not the meaning or loudness hierarchy of instruction and success.
Crossing the final goal earns the next lesson once.

## Scene 04 — Discover height

![Concept: an upward arrow and gently rising ring curve](tutorial-storyboard/scene-04.png)

**Audio:** `up.wav`, total 4.334896 s. Praise at 0.00–0.44 s and the question
about above at 0.92–2.06 s are preparation. The explicit backward lean call at
**2.66 s** releases the upward arrow; it must not appear at the question alone.

**World and action:** The arrow announces a gentle rising continuation that
can be reached with existing climb response and remaining ceiling clearance.
Actual upward movement reveals the ring chain; looking upward alone does not.
Ring openings face the local rising tangent rather than all staying vertical.
If a visible reachable course cannot be placed, the existing readiness policy
waits instead of moving an already seen object or changing the flight ceiling.

**Sound and response:** Elevation and increasing proximity belong to the fixed
world sources. The spatial mix must remain intelligible without exaggerating
pitch as an alternative instruction. Preview feedback stays local and brief;
only the final passage changes progress.

## Scene 05 — Return downward

![Concept: a downward invitation and softly descending tunnel](tutorial-storyboard/scene-05.png)

**Audio:** `down.wav`, total 2.552583 s. Praise at 0.00–0.78 s retains the
current environment. The forward lean call at **1.04 s** releases the down cue.

**World and action:** Plan a smooth descending segment from actual flight,
with the arrow aiming toward its entry direction and staying outside the hole.
After the participant begins descending, ring particles gather from their own
local surroundings. The final ring remains visibly part of the same curve.
The fourth actual goal passage completes learning; it may immediately start
the closing even if this short instruction has not finished.

**Sound and response:** Use the same success vocabulary as the earlier lessons,
with no escalating game-like fanfare. The final response settles quickly enough
for the closing voice to remain clear. Stop retired object playback at its own
lifecycle boundary; room reverberation may have a natural bounded tail.

## Scene 06 — Earned completion and a calm handoff

![Concept: local success settles into open particle space](tutorial-storyboard/scene-06.png)

**Audio:** `complete.wav`, full **13.861479 s**, only after all four passages.
The opening praise at 0.00–0.84 s accompanies the final local response. The
retrospective direction list at 1.32–3.24 s creates **no new direction cues**.
The room confirmation at 3.78–4.92 s and beginning at 5.48–6.96 s retain calm
space. The interruption at 8.14–10.08 s, narrator mention at 10.68–11.94 s and
final fetch line at 12.36–13.74 s finish without adding characters or shortening
the clip. Handoff follows the complete recording.

**World and action:** Keep freedom of movement; no new counted tunnel is offered.
The last silver/turquoise impulse expands and disperses locally while room
particles remain gentle. Older arrows retain their own visibility/retirement
rules. Existing Show/Run transition retires training and releases the prepared
main experience, preserving the visit timeline.

**Sound:** Quiet wind continues under the voice. Granular object layers retire
with their content; the existing main organ resumes its authored role without
a second wind generator or audio owner.

## Scene 07 — Miss, recover, or proceed at the time limit

![Concept: a missed section retires while a reachable invitation returns](tutorial-storyboard/scene-07.png)

**Audio:** A miss repeats the current directional instruction, including the
right instruction portion without repeating the complete orientation. Its
actual native cue marker still gates the new arrow. No success recording plays
for a miss, direct skip or timeout. At 60 playing seconds without four passages,
the integrated experience proceeds through the existing transition.

**World and action:** Missing an opening, overtaking formation or substantially
departing from a course retires that section with neutral dispersal. The lesson
stays open. Reuse its fixed pool slots for a fresh reachable offer ahead instead
of extending an impossible connection behind the participant. A new arrow may
coexist with the previous off-axis arrow within the existing two-arrow pool.
Do not suddenly turn the old arrow toward the replacement course.

An arrow remains while visible. Once its whole body has been outside the view
for **two playing seconds**, it disperses over **three playing seconds**. Ring
formation does not start this timer. Loose particles drift outward and settle
into the surrounding air instead of snapping into another object. Pool reuse
must stay bounded; it is not permission to accumulate persistent arrows.

**Sound:** A miss fades the corresponding object texture with no earned hit
accent. The replacement samples new permitted grain regions without downloading
or decoding during the frame. A restrained airflow swell may support dispersal;
it must remain distinct from the positive passage sound and subordinate to voice.

## Implementation boundary and visual acceptance

Spoken gates, actual-turn ring release, fixed world anchors, reachable arc-length
ring placement, preview/count separation, swept passages and independent arrow
retirement remain implemented. Each arrow now captures a three-dimensional axis
aimed at the common, reserved entry at birth. Its axis announces the next
guidance direction without moving after appearance. The reserved entry remains
flight-relative while arrow placement remains discoverable in the captured view. Fine particles retain their
4-pixel cap; the soft haze subset can reach 8 pixels in the existing point draw.

The existing synthesized wind accompanies the room reveal. A quiet optional CC0
wind sample joins at visible cue formation. Successful preview and counted-ring
passages play one pooled, spatial whoosh at the crossed ring position. Misses do
not trigger it. Both additional effects duck beneath speech and pause with the
experience using a short fade. Sources fade for 1.2 seconds at their old positions;
the shared hall drains for four seconds across the main handoff. The quiet wind
bed survives the earned closing. Asset sources, transformations and licenses are recorded in
[`public/audio/tutorial/effects/README.md`](../../public/audio/tutorial/effects/README.md).

The scene images express fuller soft cores, fine individual grains and modest
depth haze. They do not establish a new particle count, photographic cloud
renderer, lighting pipeline or audio selection. Formation/dispersal sound
references above describe the requested integration; shipped assets and their
licenses belong to the sound provenance and implemented recipe. Prefer existing
resource owners, shared templates and bounded shader motion. RTX 5070 Ti is the
stated PC GPU; actual Windows-PCVR USB-C 90 Hz remains the acceptance target.
Standalone PICO is a separately scoped project, not an implicit alternate runtime.

Compare actual captures of arrow-only, turn onset, tunnel entry, local hit and
retry against these qualities: readable direction, free aperture, separate
birth clouds, stable world landmarks, calm motion and a continuous spatial
invitation. Measure draw/fragment work, uploads and bounded memory alongside
visible particle count. Local browser evidence can verify timing, passage,
recycling and disposal; headset comfort, human comprehension, spatial listening
and installation frame timing require the physical setup.
