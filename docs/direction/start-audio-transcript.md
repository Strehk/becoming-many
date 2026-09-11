# Start audio transcript and action cues

Direct local transcription of the five installed German tutorial WAV files,
2026-09-10. Source audio was processed with MLX Whisper using
`mlx-community/whisper-large-v3-turbo`, German language, temperature zero and word
alignment. No script was supplied as a transcription prompt. Audio was processed
locally; model weights were downloaded. Text and punctuation are machine
transcriptions, checked for consistency against the existing scene description,
not independently verified by human listening. Timestamps are approximate and
relative to each recording, not global Show times or approved cue offsets.
German quotations preserve the spoken experience content.

The German selection uses these recordings. Their combined
file duration is 44.210104 seconds; interactive waits and repeats mean this is not
the tutorial duration. Wind and whoosh files are effects, not spoken instructions.

## 1. introduction-right

[Play source](../../public/audio/tutorial/de/introduction-right.wav) · 20.725729 seconds.

- **0.00–3.86 s:** Hallo, bevor es richtig losgeht, schauen wir kurz, ob alles da ist.
- **4.20–5.34 s:** Was brauchen wir?
- **5.74–7.50 s:** Einen Anfang? Haben wir schon.
- **7.94–9.18 s:** Dich? Haben wir auch.
- **9.56–15.46 s:** Dann brauchen wir noch einen Erzähler und natürlich einen Raum, in dem das Ganze stattfinden kann.
- **16.28–18.46 s:** Schauen wir mal, ob der schon funktioniert.
- **19.24–20.14 s:** Lehn dich mal nach rechts.

Source SHA-256: `545adc1da2ee42ede8270483ac02281c879778fc750debf9ffece1711b0f244b`.

## 2. left

[Play source](../../public/audio/tutorial/de/left.wav) · 2.735417 seconds.

- **0.00–2.22 s:** Ja, genau. Jetzt mal zur anderen Seite.

Source SHA-256: `3964679d4963dc861787ab5024933b1a98dd44d512baad36578609e184ce46a0`.

## 3. up

[Play source](../../public/audio/tutorial/de/up.wav) · 4.334896 seconds.

- **0.00–2.10 s:** Sehr gut. Und wie sieht es oben aus?
- **2.48–4.00 s:** Lehn dich mal ein bisschen nach hinten.

Source SHA-256: `79a1ba5a1000fead1ce0abdea88c8da37f61536baff9cba60a3cc3becfb55d6d`.

## 4. down

[Play source](../../public/audio/tutorial/de/down.wav) · 2.552583 seconds.

- **0.00–1.84 s:** Perfekt. Und jetzt nach vorne.

Source SHA-256: `fe05c34a5668602e31a21960de10408e1f6d4df3f37c77b0341b3ec267f49cc9`.

## 5. complete

[Play source](../../public/audio/tutorial/de/complete.wav) · 13.861479 seconds.

- **0.00–6.52 s:** Wunderbar! Links, rechts, oben, unten. Der Raum funktioniert also. Dann kann es eigentlich
- **6.52–7.00 s:** losgehen.
- **8.18–13.74 s:** Moment, da fehlt doch noch was. Ach ja, der Erzähler. Warte kurz, ich hole ihn mal.

Source SHA-256: `874e2854758de0907851de78c9fd3af09ead32e749da2b143795398ad3fbd5c7`.

## What the participant is asked to do

| Recording | Spoken cue | Required action | Visual consequence in the target concept |
| --- | --- | --- | --- |
| Introduction | “einen Raum, in dem das Ganze stattfinden kann” | No directional action yet; discover the space. | Gradually reveal particles, sky and sparse clouds. Do not invent a gesture test. |
| Introduction / right | “Lehn dich mal nach rechts.” | Lean the body right. | A full rightward arrow introduces the turn; prediction bends right with actual travel. |
| Left | “Jetzt mal zur anderen Seite.” | Lean left, relative to the previous right instruction. | Clearly show leftward guidance; the phrase depends on the established order. |
| Up | “Und wie sieht es oben aus?” followed by “Lehn dich mal ein bisschen nach hinten.” | Lean the body backward to climb. | Arrow and route point upward/forward; prediction rises. Do not show backward flight. |
| Down | “Und jetzt nach vorne.” | Lean the body forward to descend. | Arrow and route point downward/forward; prediction descends. Do not treat this as acceleration alone. |
| Complete | “Links, rechts, oben, unten. Der Raum funktioniert also.” | No new direction test; receive confirmation. | Retire the completed guidance without spawning four new cues. |
| Complete | “Warte kurz, ich hole ihn mal.” | Wait for the narrator/experience transition. | Calm visual release; no new learning targets during the wait. |

Praise at the start of later clips refers to the preceding action. The transcript
alone does not prove a successful passage: existing learning rules remain the
source of success. In particular, the completion recording assumes success and
must not be repurposed as a neutral timeout message.

## Timing and implementation distinction

### English recordings

The English selection ships the five user-supplied `Tutorial_english` recordings,
raised by 6 dB with ffmpeg's `volume` filter to approximate the German speech level.
The 48 kHz stereo float32 PCM format and sample counts are preserved; no limiting,
compression, trimming or resampling is applied. The loudest resulting sample peak
is -0.8 dBFS; mean levels range from -25.6 to -21.8 dBFS. Download originals remain
unchanged. The source mapping is
`startandright2.wav` → `introduction-right.wav`, `Left.wav` → `left.wav`,
`finish.wav` → `complete.wav`; `up.wav` and `down.wav` retain their names.
Durations were measured with ffprobe. Local MLX Whisper large-v3-turbo word
alignment, English language and temperature zero, supplies approximate markers.
Alignment is machine-derived, not sample-exact or independently human-verified.

| File | Duration (s) | Instruction (s) | Spoken instruction |
| --- | ---: | ---: | --- |
| introduction-right.wav | 18.174938 | 17.16 | Lean to the right. |
| left.wav | 3.002396 | 1.36 | Now try the other side. |
| up.wav | 3.507542 | 2.38 | Lean back a little. |
| down.wav | 2.102063 | 0.66 | And now lean forward. |
| complete.wav | 13.297396 | — | Closing speech, no new lesson. |

The opening path begins after “beginning” at 8.00 s; the room begins at “space”
at 12.94 s. Both retain the 3.2 s fade. The English approach is 18.48 m instead
of 26 m: the shorter interval before the right instruction preserves the same
remaining approach distance at 2 m/s. All later route geometry is shared.
Retries start at the instruction markers, omitting praise. Native completion,
deadline admission and closing use the selected recording's actual duration.

SHA-256 of original English files before the 6 dB gain:

- introduction-right.wav: `0eebfa3ef878be2aa32034550f636c093a2368cb1a89e656e79d71e68dd4c19c`
- left.wav: `6d6a8246967c558085708b53f64f7a0fa0e07ff1756d43bc6cdc5df340723776`
- up.wav: `6e71e4f2c12cb8382dabe4df89dc1065358a20d4d9c7229d0f250219551a014c`
- down.wav: `f514e3790e427a3d80d0984c16252aee05c5ab3a93029bef555ae8a2d37e22a0`
- complete.wav: `1ed4f77566e1cc5f26bcec9dfe0fbd2c75f6f0b24a9bb86f5bdc3a7baad1f3b2`

SHA-256 of shipped English files after the gain:

- introduction-right.wav: `5d53dbf8c86159d805236b1eeae40cf21b9479b22585b8debcc1c29c360ee3b5`
- left.wav: `b8be4b270d76ac4561f137041da693513dac9530d75e3634b71fb382c43c691b`
- up.wav: `6c33ab726f72dde32845d4d177bb5a1c57c560790bb6a04b830b0f5fcfc8074f`
- down.wav: `5776efa86077c9f9ddce610278867c03fcaf23440407305d62a40dc5292bb8e5`
- complete.wav: `1d2f2ef33631d2e25eca6ce48de98a42ff947cc151d02cc4d895c87b8e2d8b53`

### German markers

The inventory found authored cue offsets of 13.12 s for room reveal and 19.30 s
for right, then 1.14 s for left, 2.66 s for up and 1.04 s for down. These are
current configuration values, not measurements from this transcription. Do not
silently replace them with model timestamps. Exact animation release requires
listening/alignment review together with actual media playback.

Keep Show as the sole speech/time authority. Each instruction gets one cue;
Start handles local motion and passage, and presentation follows their facts.
For a retry, preserve the current direction and its necessary wording rather
than replaying the entire introduction. This document adds no new playback logic.

[Full concept](start-level-concept.md) · [Scene staging](tutorial-scene-script.md).
