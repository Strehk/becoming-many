<!--
Purpose: Track invalid Scent source states allowed by broad primitive types.
Context: Directional contracts exist but some identities are represented as number or string.
Responsibility: Make current source vocabularies explicit without a schema framework.
Boundary: This does not couple Scent to concrete provider implementations.
-->

# Tighten Scent Source Types

**Status:** Open
**Priority:** Contract integrity

## Problem

Plant sources push a numeric `groupIndex`, actor sources use unrestricted
`speciesId: string`, and level presets can specify visible and invisible
vegetation simultaneously. Invalid values are therefore possible despite the
existing typed ownership boundary.

## Affected Files

- `src/modules/scent-sources.ts`
- `src/modules/animal-species.ts`
- `src/modules/animals/animals-definition.ts`
- `src/modules/vegetation/vegetation-scent.ts`
- `src/modules/scent-particles/scent-particle-field.ts`
- `src/modules/scent-particles/scent-particles-settings.ts`
- `src/levels/level-runtime.ts`
- `tests/modules/scent-particles.test.ts`

## Smallest YAGNI Solution

Pass `PlantScentGroupId` directly instead of translating through a numeric
index. Define the fixed species vocabulary once in a neutral
`src/modules/animal-species.ts` boundary, derive `AnimalSpeciesId` from its
literal tuple, and use that type in both the Animals definition and Scent
contracts. The current `AnimalSpeciesDefinition.id: string` annotation widens
the IDs and therefore cannot be the source of the union by itself.

Represent visible versus invisible vegetation as a mutually exclusive union.
Do not add runtime schemas or code generation. Neither provider imports the
other provider's implementation; both depend only on the neutral contract.

## Verification

Add compile-time invalid-state fixtures and preserve the current runtime Scent
tests and fixed-capacity behavior.
