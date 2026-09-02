<!--
Purpose: Track stale controller state crossing an M5 host change.
Context: Polling may still complete after the operator selects another host.
Responsibility: Keep one host generation isolated from the next.
Boundary: This does not replace HTTP polling or add a transport framework.
-->

# Reset M5 State on Host Change

**Status:** Open
**Priority:** Control safety

## Problem

Changing the M5 host stops only the interval. An in-flight fetch can publish a
late state, and smoothing, button counters, freshness, and the last control
frame remain associated with the previous device.

## Affected Files

- `src/m5/state-polling.ts`
- `src/m5/m5-adapter.ts`
- `src/m5/control-source.ts`
- `tests/m5/control-source.test.ts`

## Smallest YAGNI Solution

Give each `watch()` call a generation number and an `AbortController`. Ignore
responses from older generations, abort the previous fetch, and create a fresh
`ControlSource` for the new host. Add one short fetch timeout. Do not add a
request scheduler, retry library, or generic cancellation layer.

## Verification

Test that delayed responses from host A cannot affect host B and that host B
can poll immediately after host A hangs.
