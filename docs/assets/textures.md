# Textures

There are no standalone runtime texture files. Existing model textures are
embedded in GLBs; the empty `public/textures/` placeholder has been retired.

Create `public/textures/` only when a runtime consumer needs a selected shipping
texture. Source files,
intermediate exports, and authoring material belong outside `public`.
