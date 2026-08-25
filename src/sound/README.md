# Sound

This module contains the experience audio layer, sound playback, and authored
audio cues.

The audio clock remains authoritative for narrative timing. Sound resources
must be bounded, synchronized with the shared timeline, and fully released
when the module is unloaded.
