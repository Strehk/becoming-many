# Tutorial flight effects

Two replaceable mono sources for the existing tutorial sound owner. These are
independent of the narration and granular atmosphere recordings. Runtime placement,
distance attenuation, gain, playback and disposal remain with that owner.
The optional `startAudio.effects` recipe selects these two sources. Wind uses one
quiet looping player on the shared context after the first visual reveal; pause
preserves its loop offset and speech ducks its output. One reusable passage player
follows actual goal or first preview crossings at their fixed world positions,
coalesces multiple crossings in one frame, and shares the existing spatial owner
and hall. Paused or missed passages produce no success sound. Omitting the recipe
allocates neither effect player nor its buffers.

| File | Source and author | Format | Length | Size |
| --- | --- | --- | --- | --- |
| `wind-soft-loop.wav` | [wind1](https://opengameart.org/content/wind1), Luke.RUSTLTD | 48 kHz mono PCM16 | 12 s | 1,152,044 bytes |
| `whoosh-soft.wav` | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack), artisticdude; `swishes/swish-1.wav` | 48 kHz mono PCM16 | 0.252083 s | 24,278 bytes |

Both original asset pages explicitly list
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
Credit is retained here for provenance; neither author endorses this experience.
The wind source is synthesized wind. The whoosh source is recorded object movement
through air. Only the selected archive member was extracted.

## Preparation and verification

`provenance.json` records direct downloads, original and prepared SHA-256 hashes,
exact filters, the selected archive member and the loop construction. Originals
were downloaded on September 9, 2026; processing used FFmpeg 8.1.1.

The wind uses source seconds 8–21, removes rumble with a 100 Hz high-pass, softens
high frequencies with a 2.6 kHz low-pass, and raises the quiet source by 12 dB.
A one-second cyclic linear crossfade creates a 12-second continuous loop without
baking a start/stop fade into every repetition. The loop boundary changes by 83
PCM16 units, approximately 0.00253 full scale, between adjacent samples.

The short whoosh plays at half its original rate, is filtered at 120 Hz/4.5 kHz,
reduced by 9 dB, and has 15 ms attack and 80 ms release fades. No reverb or spatial
panning is baked into either file; the shared runtime applies spatial behavior.

Both files fully decode with FFmpeg, are mono and below 2 MB each. Measured sample
peaks are -10.5 dBFS (wind) and -12.8 dBFS (whoosh), with mean levels -27.3 and
-27.6 dBFS. Combined decoded mono float32 storage is 2,352,400 bytes at 48 kHz.
These checks verify preparation, not perceived quality. Final listening, balance
under narration and physical PCVR acceptance remain open.
