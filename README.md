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

The countdown uses an absolute target time, so switching tabs or a delayed screen refresh does not make it drift. It remains at `00:00` until the operator starts the next loop.

### Lyrics presenter

1. Open **Lyrics** and paste the complete song.
2. Select **Generate two-line slides**. Blank lines are ignored and every two non-empty source lines become one slide.
3. Edit either line, reorder slides, split or merge one-line slides, and choose optional per-slide backgrounds.
4. Double-click the large preview or select **Present fullscreen**.

Each source line is kept on one visual row. The text automatically shrinks when needed, so a slide never wraps into three or four displayed lines.

Presentation controls:

- `Arrow Right`, `Space`, or `Page Down` — next slide
- `Arrow Left` or `Page Up` — previous slide
- `Home` / `End` — first / last slide
- `B` — toggle a black projection screen
- `Esc` — exit presentation

Decks autosave locally. **Export JSON** creates a portable backup, and **Import JSON** restores a validated Church Presenter deck. The browser display is kept awake while a timer or lyrics presentation is active when the Wake Lock API is supported.

## Offline behavior

After the first successful visit, the application shell, fonts, icons, and code are cached by its service worker. The timer, lyrics editor, saved deck, and presentation controls then work without a network connection. A small notification appears when the application is ready offline or when a new version is available.

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
