/**
 * Purpose: Show which release of Becoming Many this is.
 * Context: Under the title the menu names the latest release published on
 *   GitHub, linked to its release notes, instead of a subtitle.
 * Responsibility: Read the latest release once per session and fill every
 *   [data-version] element; stay empty if GitHub cannot be reached.
 * Boundary: Only the public GitHub API; nothing about the visitor is sent.
 */

import { REPOSITORY_URL } from "./menu-flow.js";

const API = "https://api.github.com/repos/Strehk/becoming-many/releases/latest";
const CACHE_KEY = "becoming-many-release";

function fill(release) {
  for (const node of document.querySelectorAll("[data-version]")) {
    node.textContent = release.tag;
    if (node instanceof HTMLAnchorElement) node.href = release.url;
    node.hidden = false;
  }
}

export async function showVersion() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      fill(JSON.parse(cached));
      return;
    }
  } catch {
    // Storage may be blocked; read from GitHub instead.
  }
  try {
    const response = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return;
    const data = await response.json();
    const release = {
      tag: data.tag_name,
      url: data.html_url ?? `${REPOSITORY_URL}/releases`,
    };
    fill(release);
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(release));
    } catch {
      // Not remembered; it is read again next time.
    }
  } catch {
    // Offline: the line simply stays empty.
  }
}
