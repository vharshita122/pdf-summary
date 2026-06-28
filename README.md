# PDF Summarizer

A fully offline Progressive Web App that summarizes PDF documents using on-device AI. No cloud APIs — everything runs in your browser.

## Features

- Upload PDFs via drag-and-drop or file picker
- Extract text locally with PDF.js
- Summarize with Transformers.js (DistilBART model)
- Works offline after first-time model download
- Installable PWA for desktop and mobile

## First-time setup

1. Open the app while **online**
2. Click **Download AI model** (~250 MB, cached in browser)
3. Install the app via the browser install prompt (optional)

After that, the app and model work fully offline.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Production build

```bash
npm run build
npm run preview
```

Serve the `dist/` folder with any static host. HTTPS is required for PWA install in production.

## Limitations

- Scanned/image-only PDFs without embedded text cannot be summarized
- Large documents are split into chunks; very long PDFs take longer
- First model load requires an internet connection

## Privacy

All PDF processing and AI inference happen locally. No data is sent to any server.
