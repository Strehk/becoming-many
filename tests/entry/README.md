# Browser Entry Tests

These tests verify that the standalone-level entry loads Zone Visualizer only for the
standalone preset that requests it. Concrete module behavior stays in module
tests; layout, startup and page-exit integration use the
[existing browser checks](../browser/README.md).
