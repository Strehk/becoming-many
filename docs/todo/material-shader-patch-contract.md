<!--
Purpose: Track the mismatch between the sensed-material type and shader patch requirements.
Context: Any ShaderMaterial is accepted even when required Three.js include anchors are absent.
Responsibility: Make unsupported material use fail explicitly.
Boundary: This does not introduce a shader graph or general material framework.
-->

# Tighten the Material Shader Patch Contract

**Status:** Open
**Priority:** Contract integrity

## Problem

`SensedMaterial` accepts every `ShaderMaterial`, while `applyShaderPatch()`
requires specific Three.js include anchors and silently uses `String.replace()`
when they are missing. The type therefore permits a valid-looking but partially
unpatched material.

## Affected Files

- `src/utils/asset-loader/material-effect.ts`
- `src/utils/asset-loader/material-shader-patch.ts`
- `tests/modules/echo-depth.test.ts`
- `tests/modules/thermal-perception.test.ts`

## Smallest YAGNI Solution

Validate each required anchor during `onBeforeCompile` and throw an error naming
the material and missing anchor. Narrow the type if current consumers permit it.
Keep the existing patch mechanism. Do not add a shader DSL, material registry,
or compile-time GLSL parser.

## Verification

Add one test with a ShaderMaterial missing an anchor and verify that it fails
clearly rather than silently rendering without the effect.
