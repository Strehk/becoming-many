/**
 * Purpose: The legal notice (Impressum) and privacy policy of the web release.
 * Context: A German website needs a legal notice (§ 5 DDG) and a privacy
 *   policy (Art. 13 GDPR), even for a non-commercial project hosted on
 *   GitHub Pages. The texts describe exactly what this page does: hosting on
 *   GitHub Pages, one request to the GitHub API for the release number, the
 *   settings kept in the browser, and nothing else (no cookies, no tracking,
 *   no third-party fonts or embeds).
 * Responsibility: Hold both texts in German and English, and render them
 *   with the operator's details into [data-legal] elements.
 * Boundary: Not legal advice; the operator checks the texts before release.
 *   The operator's personal details are not committed: the build reads them
 *   from the LEGAL_* environment variables (see .env.example), and
 *   release build (vite.config.ts, `--mode release`) refuses to build without
 *   them.
 *   Audience-facing German copy, everything around it English.
 */

const env = import.meta.env ?? {};

/**
 * The responsible person, as published in the legal notice. Empty values
 * only occur on the dev server; the build requires them.
 */
export const OPERATOR = {
  names: env.LEGAL_NAME ?? "",
  street: env.LEGAL_STREET ?? "",
  city: env.LEGAL_CITY ?? "",
  country: env.LEGAL_COUNTRY ?? "",
  email: env.LEGAL_EMAIL ?? "",
};

const UPDATED = { de: "November 2026", en: "November 2026" };

const address = () =>
  [OPERATOR.names, OPERATOR.street, OPERATOR.city, OPERATOR.country].filter(
    Boolean,
  );

/** Blocks: [heading, ...paragraphs]; a paragraph array is a list of lines. */
const TEXT = {
  imprint: {
    de: [
      ["Impressum"],
      ["Angaben gemäß § 5 DDG", address()],
      ["Kontakt", [`E-Mail: ${OPERATOR.email}`]],
      [
        "Über dieses Angebot",
        "Becoming Many ist ein nicht-kommerzielles künstlerisches Projekt, entstanden in Kooperation mit dem Futurium und der HTW Berlin. Der Quellcode ist offen auf GitHub veröffentlicht.",
      ],
      [
        "Haftung für Links",
        "Diese Seite enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar; werden uns solche bekannt, entfernen wir den Link umgehend.",
      ],
    ],
    en: [
      ["Legal notice"],
      [
        "Information according to § 5 DDG (German Digital Services Act)",
        address(),
      ],
      ["Contact", [`Email: ${OPERATOR.email}`]],
      [
        "About this site",
        "Becoming Many is a non-commercial artistic project, made in cooperation with the Futurium and HTW Berlin. Its source code is published openly on GitHub.",
      ],
      [
        "Links",
        "This site links to external websites of third parties whose content we do not control; their providers are responsible for it. No legal violations were apparent when the links were set; we remove a link as soon as we learn of one.",
      ],
    ],
  },
  privacy: {
    de: [
      ["Datenschutzerklärung"],
      ["Verantwortlich", [...address(), `E-Mail: ${OPERATOR.email}`]],
      [
        "Das Wichtigste vorweg",
        "Diese Seite setzt keine Cookies, verwendet kein Tracking und keine Analysedienste und lädt keine Schriften, Videos oder anderen Inhalte von fremden Servern. Alles, was das Erlebnis braucht, kommt von derselben Adresse wie die Seite selbst.",
      ],
      [
        "Hosting über GitHub Pages",
        "Die Seite wird über GitHub Pages bereitgestellt, einen Dienst der GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten wie deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Datei und Angaben zu Browser und Betriebssystem, um die Seite auszuliefern und den Dienst abzusichern. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und funktionsfähigen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO). GitHub ist unter dem EU-US Data Privacy Framework zertifiziert. Näheres: https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement",
      ],
      [
        "Anzeige der Version",
        "Um die aktuelle Versionsnummer anzuzeigen, fragt die Seite einmal pro Sitzung die öffentliche Schnittstelle von GitHub (api.github.com) ab. Dabei wird deine IP-Adresse an GitHub übermittelt; es werden keine weiteren Daten gesendet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.",
      ],
      [
        "Speicherung in deinem Browser",
        "Deine Einstellungen (etwa Sprache, Lautstärke, Grafik und Steuerung) und die zuletzt abgefragte Versionsnummer werden nur lokal in deinem Browser gespeichert (Local Storage bzw. Session Storage) und nie übertragen. Das ist für die von dir gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst diese Daten jederzeit über die Einstellungen deines Browsers löschen.",
      ],
      [
        "Kamerasteuerung",
        "Wenn du in den Einstellungen die Steuerung mit der Kamera wählst, fragt dein Browser nach dem Zugriff auf deine Kamera. Das Kamerabild wird ausschließlich lokal in deinem Browser ausgewertet: Ein mit der Seite ausgeliefertes Modell erkennt die Lage von Schultern und Händen, daraus wird die Flugrichtung berechnet. Das Bild wird weder gespeichert noch übertragen, und es werden dafür keine Inhalte von fremden Servern geladen. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du durch die Freigabe im Browser erteilst und jederzeit widerrufen kannst, indem du die Steuerung umstellst oder den Kamerazugriff in deinem Browser entziehst.",
      ],
      [
        "VR-Brille",
        "Wenn du mit einer VR-Brille eintrittst, verarbeitet dein Browser die Bewegungen der Brille ausschließlich lokal auf deinem Gerät, um das Bild darzustellen. Diese Daten verlassen dein Gerät nicht.",
      ],
      [
        "Links zu anderen Seiten",
        "Links zum Futurium, zur HTW Berlin, zu GitHub und zu persönlichen Websites werden erst geladen, wenn du sie anklickst. Danach gelten die Datenschutzhinweise der jeweiligen Seite.",
      ],
      [
        "Deine Rechte",
        "Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten, auf Datenübertragbarkeit sowie auf Widerspruch gegen die Verarbeitung (Art. 15–21 DSGVO). Wende dich dafür an die oben genannte E-Mail-Adresse. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren.",
      ],
      [`Stand: ${UPDATED.de}`],
    ],
    en: [
      ["Privacy policy"],
      ["Controller", [...address(), `Email: ${OPERATOR.email}`]],
      [
        "In short",
        "This site sets no cookies, uses no tracking or analytics and loads no fonts, videos or other content from third-party servers. Everything the experience needs comes from the same address as the page itself.",
      ],
      [
        "Hosting on GitHub Pages",
        "The site is served by GitHub Pages, a service of GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. When you visit, GitHub processes technically necessary connection data such as your IP address, date and time, the requested file and details about your browser and operating system, to deliver the site and keep the service secure. The legal basis is our legitimate interest in a secure, working site (Art. 6 (1) (f) GDPR). GitHub is certified under the EU-US Data Privacy Framework. More: https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement",
      ],
      [
        "Version number",
        "To show the current version number, the site asks GitHub's public interface (api.github.com) once per session. This sends your IP address to GitHub and nothing else. The legal basis is Art. 6 (1) (f) GDPR.",
      ],
      [
        "Storage in your browser",
        "Your settings (such as language, volume, graphics and controls) and the last version number are kept only in your browser (local and session storage) and are never transmitted. This is strictly necessary for the function you ask for (§ 25 (2) no. 2 TDDDG). You can delete them at any time in your browser's settings.",
      ],
      [
        "Camera controls",
        "If you choose camera controls in the settings, your browser asks for access to your camera. The camera image is analysed only locally in your browser: a model shipped with the site finds where your shoulders and hands are, and the flight direction is computed from that. The image is neither stored nor transmitted, and nothing is loaded from third-party servers for it. The legal basis is your consent (Art. 6 (1) (a) GDPR), given by allowing access in your browser; you can withdraw it at any time by switching the controls back or revoking camera access in your browser.",
      ],
      [
        "VR headset",
        "If you enter with a VR headset, your browser processes the headset's movements only locally on your device to draw the image. This data does not leave your device.",
      ],
      [
        "Links to other sites",
        "Links to the Futurium, HTW Berlin, GitHub and personal websites load only when you click them; their own privacy policies then apply.",
      ],
      [
        "Your rights",
        "You have the right to access, rectification, erasure and restriction of processing, to data portability and to object to processing (Art. 15–21 GDPR). Contact the email address above. You may also lodge a complaint with a data protection supervisory authority.",
      ],
      [`Last updated: ${UPDATED.en}`],
    ],
  },
};

/** Render both texts in the current language into [data-legal] elements. */
export function renderLegal(language) {
  const lang = language === "en" ? "en" : "de";
  for (const node of document.querySelectorAll("[data-legal]")) {
    const blocks = TEXT[node.dataset.legal]?.[lang];
    if (!blocks) continue;
    const parts = [];
    blocks.forEach(([heading, ...paragraphs], index) => {
      const title = document.createElement(index === 0 ? "h2" : "h3");
      title.className = index === 0 ? "heading legal__title" : "legal__heading";
      title.textContent = heading;
      parts.push(title);
      for (const paragraph of paragraphs) {
        const p = document.createElement("p");
        p.className = "legal__text";
        if (Array.isArray(paragraph)) {
          paragraph.forEach((line, n) => {
            if (n > 0) p.append(document.createElement("br"));
            p.append(line);
          });
        } else p.textContent = paragraph;
        parts.push(p);
      }
    });
    node.replaceChildren(...parts);
  }
}
