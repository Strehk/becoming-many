<!--
Purpose: Track the missing top-level teardown path.
Context: Modules own cleanup, but the VR, Test, and Conductor applications do not expose complete lifecycles.
Responsibility: Connect existing cleanup handles without inventing a framework.
Boundary: This does not add dependency injection or a general lifecycle registry.
-->

# Complete the Application Lifecycle

**Status:** Open
**Priority:** Reliability
**Issue:** [#9](https://github.com/Strehk/becoming-many/issues/9)
**Depends on:** [#19](https://github.com/Strehk/becoming-many/issues/19) and
[#37](https://github.com/Strehk/becoming-many/issues/37) for the final entry and
channel file names

## Problem

`startWorld()` and `RunningLevel` expose no application teardown. Existing
cleanup for modules, renderer loop, resize listener, audio, M5 polling, assets,
and browser control channels is therefore unreachable or discarded. The
Conductor also owns listeners, an optional animation handle, and its channel.

## Affected Files

- `src/world/world-runtime.ts`
- `src/levels/level-runtime.ts`
- `src/vr/vr-main.ts`
- `src/test/test-main.ts`
- `src/conductor/conductor-main.ts`
- `src/vr/show-control.ts`
- `src/control-wire/channel.ts`
- `src/m5/m5-adapter.ts`

## Smallest YAGNI Solution

Implement the source-of-truth cleanup first: return one idempotent `unload()`
from the current `startWorld()` and compose it into `RunningLevel.unload()`.
That work does not depend on future entry paths.

After issues #19 and #37 land, each resulting browser entry retains and closes
only the resources it creates, including its `BroadcastChannel`, timers, DOM
listeners, and optional animation handle. Call child unload functions in
reverse ownership order. Do not add a lifecycle manager, event bus, service
container, or restart state machine.

## Verification

Test that two unload calls are safe and that timers, channels, listeners, render
loop, modules, and renderer resources are released independently for VR, Test,
and Conductor.
