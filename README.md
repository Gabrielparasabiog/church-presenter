# Church Presenter

A private, serverless church presentation tool with a precise countdown timer and a two-line lyrics editor. It is designed for projectors, works offline after the first visit, and stores all service content only in the current browser.

## Routes

- `#/` — home and mode selection
- `#/timer` — silent countdown timer
- `#/lyrics` — lyrics generator, editor, and fullscreen presenter

## Local development

```bash
npm install
npm run dev
```

Before publication, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The production base path is `/church-presenter/` for GitHub Pages.
