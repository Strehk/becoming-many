/**
 * Purpose: Bootstrap the Becoming Many application.
 * Context: This is the minimal browser entry point.
 * Responsibility: Select the initial level and start the Level Runtime.
 * Boundary: Composition, rendering, and world behavior live elsewhere.
 */

import "./style.css";
import { level } from "./levels/designTest.level";
import { startLevel } from "./levels/level-runtime";

await startLevel(document.querySelector(".app"), level);
