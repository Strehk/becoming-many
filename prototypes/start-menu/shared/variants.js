/**
 * Purpose: List the ten start-menu prototypes once for the gallery and the switcher.
 * Responsibility: Folder names, display names, tone and a one-line design note.
 * Boundary: Each variant's look and behaviour live in its own folder.
 */

export const VARIANTS = [
  {
    slug: "01-white-room",
    name: "White Room",
    tone: "standard",
    note: "Centred title and a plain vertical menu in White World, with the Start level's grey air motes drifting past. A thin bar loads.",
    palette: [0xffffff, 0x899096, 0x202126, 0xfb5f16],
  },
  {
    slug: "02-credits-plate",
    name: "Credits Plate",
    tone: "standard",
    note: "Set exactly like the end-credits panel: title, quiet role line, names. The menu items take the names' place while finale scent motes rise from below.",
    palette: [0xffffff, 0x000000, 0x55d1ba, 0xb185c2],
  },
  {
    slug: "03-night-index",
    name: "Night Index",
    tone: "standard",
    note: "A conventional left-aligned game menu on a dark field of glowing scent signatures. Large numbered items, orange grain-light hover marker.",
    palette: [0x0e0628, 0x6adadd, 0xfdbb54, 0xfb5f16],
  },
  {
    slug: "04-particle-trail",
    name: "Particle Trail",
    tone: "hybrid",
    note: "Loading draws the Start level's teal particle path across the screen. The menu items sit as stations on that route; hovering sends the orange light sweep to them.",
    palette: [0xffffff, 0x2c858d, 0x77bec2, 0xfb5f16],
  },
  {
    slug: "05-rings",
    name: "Rings",
    tone: "experimental",
    note: "Black dust-grain rings from the tutorial. Loading assembles the first ring grain by grain; each menu choice is a ring, and choosing one flies you through it.",
    palette: [0xffffff, 0x000000, 0xfb5f16, 0x899096],
  },
  {
    slug: "06-dust-letters",
    name: "Dust Letters",
    tone: "experimental",
    note: "BECOMING MANY condenses out of drifting air motes while loading. The pointer scatters the letters; beginning dissolves the title into the finale's colours.",
    palette: [0xffffff, 0x202126, 0x899096, 0xa865c7],
  },
  {
    slug: "07-scent-plumes",
    name: "Scent Plumes",
    tone: "experimental",
    note: "Every menu item is a plant with its own scent signature. Loading lets the plumes rise; hovering an item makes its plant breathe out, wind follows the pointer.",
    palette: [0xf7f7f7, 0x50be81, 0x6adadd, 0xfda39d],
  },
  {
    slug: "08-connection-web",
    name: "Connection Web",
    tone: "experimental",
    note: "The finale's web: nodes in vegetation, scent, rock and soil colours, linked one by one while loading. Menu items are nodes; amber pulses travel to the one you point at.",
    palette: [0xf7f7f7, 0xa5bdc3, 0xd06780, 0xe39e54],
  },
  {
    slug: "09-one-to-many",
    name: "One to Many",
    tone: "experimental",
    note: "Loading is a single grain that keeps dividing until it is a swarm in all finale colours. Press and hold to begin; the swarm splits into one cluster per way to enter.",
    palette: [0xffffff, 0x000000, 0xd5198a, 0xfcce43],
  },
  {
    slug: "10-flight",
    name: "Flight",
    tone: "experimental",
    note: "You already fly: a depth field of air motes and rings streams toward you, steered by mouse or phone tilt. The menu hugs the corners like a heads-up display.",
    palette: [0xffffff, 0x899096, 0x2c858d, 0x000000],
  },
];
