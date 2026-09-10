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

Both current DE and EN selections use these same German recordings. The combined
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
