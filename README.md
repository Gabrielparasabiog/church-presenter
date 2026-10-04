# Church Presenter

Church Presenter is a projector-first, offline-ready worship utility with two focused tools:

- an exact, silent service countdown; and
- a lyrics editor that converts pasted lyrics into strictly one or two displayed lines per slide.

The application is a static Vite + TypeScript PWA. It has no account, backend, analytics, or upload API. Lyrics, deck position, duration, and screen theme remain in the current browser's local storage.

## Use it

### Countdown timer

1. Open **Timer**.
2. Enter hours, minutes, and seconds.
3. Choose chroma green, black, or white.
4. Start the countdown or enter fullscreen.

Keyboard controls work when a form field is not focused:

- `Space` — start, pause, resume, or begin the next loop
- `R` — reset
- `F` — enter or exit fullscreen

The countdown uses an absolute target time, so switching tabs or a delayed screen refresh does not make it drift. When you return to the Timer tab, the display immediately catches up—including reaching `00:00` if time expired while hidden. Keep the Timer page open for the countdown to continue; it does not run after navigating away or refreshing. It remains at `00:00` until the operator starts the next loop.

### Lyrics presenter

1. Open **Lyrics** and paste the complete song.
2. Select **Generate two-line slides**. Blank lines are ignored; long source lines are split at spaces into additional slides so each lyric row stays readable. Keep spaces between words—an unbroken word that cannot fit is preserved in the source and reported instead of being silently cut off.
3. Preview the current slide in all four views together: **Black & White**, **Custom Color** (chroma green by default, with automatic text contrast), **Dark 3D Church** (10 bundled sanctuary scenes), and **Lower Third**. The four quick choices directly above the previews select the view used for presentation; each slide can follow the deck default or use its own view and background.
4. Edit either line, reorder slides, split or merge one-line slides.
5. Double-click the large preview or select **Present fullscreen**.

Each source line is kept on one visual row. The text automatically shrinks when needed, so a slide never wraps into three or four displayed lines.

Presentation controls:

- `Arrow Right`, `Space`, or `Page Down` — next slide
- `Arrow Left` or `Page Up` — previous slide
- `Home` / `End` — first / last slide
- `B` — toggle a black projection screen
- `Esc` — exit presentation

Decks autosave locally. **Export JSON** creates a portable backup, and **Import JSON** restores a validated Church Presenter deck. The browser display is kept awake while a timer or lyrics presentation is active when the Wake Lock API is supported.

## Offline behavior

After the first successful visit, the application shell, fonts, icons, code, and all 10 church backgrounds are cached by its service worker. The timer, lyrics editor, saved deck, and presentation controls then work without a network connection. A small notification appears when the application is ready offline or when a new version is available.

Existing version-one JSON exports and locally saved decks remain importable. Original white-theme slides keep their white appearance; new decks default to the Custom Color view.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Run the complete verification suite before publishing:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The production base path is `/church-presenter/` for GitHub Pages. Pushes to `main` run `.github/workflows/deploy-pages.yml`, which verifies and deploys the generated `dist` artifact.

## GitHub Pages setup

For the `church-presenter` repository:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push or manually run **Verify and deploy Church Presenter**.
4. Open `https://gabrielparasabiog.github.io/church-presenter/`.

Do not commit service lyrics or exported deck files unless they are intentionally public. A public repository exposes every committed file even though the running site itself does not upload browser-stored lyrics.
