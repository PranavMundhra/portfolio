# Pranav Mundhra — portfolio

A buildless static portfolio: plain HTML, CSS and a little JavaScript. There is nothing to install or compile, and no backend. Core content and navigation work without JavaScript. The script adds the print button on the resume page, the section-nav highlighting, scroll fade-ins, a dot grid that bulges outward around the cursor, a custom dot-and-ring cursor and the surname typing effect, and it respects reduced-motion settings.

## Local preview

```sh
npm run dev
```

Open <http://127.0.0.1:4173>. Stop the server with Ctrl+C. Set `PORT` to use a different port.

```sh
npm run check
```

The checker validates every HTML page: relative links and anchors, titles and descriptions, a single `h1`, skip links, image alt text, and leftover editorial placeholders. It does not check external services.

## Case-study extras

- **Layout:** a large dot-matrix title opens each case study and the text column is centred on the screen. Diagrams are slightly wider than the text.
- **Listen:** `assets/listen.js` reads a case study aloud using the browser's built-in speech voices (Web Speech API). Nothing is uploaded, and the player does not appear in browsers without speech support. One button sits under the title, with speed and voice in a small settings popover. While audio plays, a slim control strip (play, pause, next and previous section, stop) appears under the top bar, the paragraph being read is highlighted, and the speed and voice are remembered. A small play icon beside each heading starts reading from that section.
- **Diagrams:** each case study has inline SVG diagrams themed with the site colours (styles are under "Project diagrams" in `assets/styles.css`). Wide diagrams scroll sideways on small screens instead of shrinking.
- **On this page:** built from the section headings by `assets/site.js`. On wide screens it is a rail in the left margin; on smaller screens it is an Index dropdown in the slim top bar, which also shows reading progress.

## Structure

- `index.html`: homepage (about, AISEHack, currently building, projects, experience, contact).
- `aisehack/`: AISEHack 2026 case study with the team photo and architecture sketch.
- `projects/`: case studies for Distributed-ML, Wind-Turbine, OTTools and VoiceRX. Other projects appear as cards on the homepage without a case study.
- `resume/`: HTML resume overview with browser print support.
- `assets/`: `styles.css`, `personal.css`, `site.js` (page effects), `listen.js` (read aloud), fonts, the portrait and the icons.
- `scripts/serve.mjs`: local-only preview server. `scripts/check-site.mjs`: the checker above.

## Deploying

Deploy the HTML folders and `assets/` together; links are relative, so the site works at the root of a domain or under a repository path such as `/portfolio/`. With GitHub Pages, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. For a custom domain, add a `CNAME` file containing the domain and set the DNS records as GitHub documents.

## Credits

GitHub and LinkedIn icons are from [Bootstrap Icons](https://github.com/twbs/icons) (MIT, see `assets/icons/LICENSE-bootstrap.txt`). PyPI and Google Drive icons are from [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0). The mail and document icons are local artwork. Platform marks remain subject to their owners' brand policies.

Body text uses [Inter](https://github.com/rsms/inter) by The Inter Project Authors (SIL Open Font License 1.1), self-hosted in `assets/fonts/` with its licence text (`OFL-Inter.txt`), so every device renders the same.

The dot-matrix headings use [Doto](https://github.com/oliverlalan/Doto) by The Doto Project Authors under the SIL Open Font License 1.1, self-hosted in `assets/fonts/` with its licence text (`OFL-Doto.txt`).

Site content and photos © Pranav Mundhra. All rights reserved.
