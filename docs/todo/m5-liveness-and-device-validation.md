<!--
Purpose: Track incomplete safety criteria for accepting M5 control data.
Context: A structurally valid recent payload is currently enough to report a live device.
Responsibility: Define the minimum evidence required before steering.
Boundary: This does not add device provisioning or cryptographic identity.
-->

# Enforce M5 Liveness and Device Validation

**Status:** Open
**Priority:** Control safety

## Problem

`expectedDeviceId` is empty, sequence progress is not checked, calibration is
ignored, and a firmware mismatch continues steering. The `live` status therefore
overstates the actual trust and liveness evidence.

## Affected Files

- `src/m5/m5-settings.ts`
- `src/m5/protocol.ts`
- `src/m5/control-source.ts`
- `src/m5/m5-adapter.ts`
- `src/station/station-protocol.ts`
- `tests/m5/control-source.test.ts`

## Smallest YAGNI Solution

Require one configured device ID, compatible firmware, `isCalibrated === true`,
and a progressing sequence number before producing non-neutral control. Reuse
the existing status path to expose the rejection reason. Do not add discovery,
pairing, certificates, or a device registry.

## Verification

Add focused tests for wrong ID, frozen sequence, uncalibrated state, and
firmware mismatch; all must remain neutral and operator-visible.
