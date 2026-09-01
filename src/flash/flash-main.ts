/**
 * Purpose: Bootstrap the M5 flash and setup page.
 * Context: A technician opens /flash.html with an M5StickS3 on USB.
 * Responsibility: Mount the page into the document.
 * Boundary: Everything the page does lives in src/flash and src/m5.
 */

import { startFlashPage } from "./flash-page";

startFlashPage(document.querySelector(".flash"));
