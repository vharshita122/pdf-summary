import { extractTextFromPdf } from './pdf.js';
import { summarizeText, parseStudySummary, highlightTerms, topKeywords } from './summarizer.js';
import './style.css';

const app = document.getElementById('app');

/** @type {'idle' | 'processing' | 'done' | 'error'} */
let state = 'idle';
let summaryResult = '';
let errorMessage = '';
let extractedPreview = '';
let fileMeta = null;

function render() {
  const offline = !navigator.onLine;

  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header__brand">
          <div class="header__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </div>
          <div>
            <h1>PDF Summarizer</h1>
            <p class="header__tagline">Concise study-note summaries</p>
          </div>
        </div>
        <div class="header__actions">
          <span class="badge ${offline ? 'badge--offline' : 'badge--online'}" title="${offline ? 'Offline mode' : 'Online'}">
            ${offline ? 'Offline' : 'Online'}
          </span>
          <button id="install-btn" class="btn btn--ghost btn--sm" hidden>Install app</button>
        </div>
      </header>

      <main class="main">
        <section class="card">
          <h2>Upload PDF</h2>
          <div
            id="dropzone"
            class="dropzone ${state === 'processing' ? 'dropzone--disabled' : ''}"
            tabindex="0"
            role="button"
            aria-label="Upload PDF file"
          >
            <input type="file" id="file-input" accept=".pdf,application/pdf" hidden />
            <div class="dropzone__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p class="dropzone__title">Drop a PDF here or click to browse</p>
            <p class="dropzone__hint">Your files never leave this device</p>
          </div>

          ${fileMeta ? `
            <div class="file-info">
              <span class="file-info__name">${escapeHtml(fileMeta.name)}</span>
              <span class="file-info__meta">${fileMeta.pages} pages · ${formatBytes(fileMeta.size)}</span>
            </div>
          ` : ''}
        </section>

        ${state === 'processing' ? `
          <section class="card">
            <div class="progress-block">
              <div class="spinner" aria-hidden="true"></div>
              <p id="process-status">Processing…</p>
              <div class="progress-bar progress-bar--indeterminate"><div class="progress-bar__fill"></div></div>
            </div>
          </section>
        ` : ''}

        ${state === 'error' ? `
          <section class="card card--error" role="alert">
            <h2>Something went wrong</h2>
            <p>${escapeHtml(errorMessage)}</p>
            <button id="retry-btn" class="btn btn--ghost">Try again</button>
          </section>
        ` : ''}

        ${state === 'done' && summaryResult ? renderSummary(summaryResult) : ''}
      </main>

      <footer class="footer">
        <p>All processing happens locally. No data is sent to any server.</p>
      </footer>
    </div>
  `;

  bindEvents();
}

function renderSummary(text) {
  const s = parseStudySummary(text);
  const keywords = topKeywords(s.overview.concat(s.points).join(' '));

  const overviewHtml = s.overview
    .map((line) => `<p class="notes-overview__line">${highlightTerms(line, keywords)}</p>`)
    .join('');

  const pointsHtml = s.points.length
    ? `<ul class="notes-list">${s.points.map((p) => `<li>${highlightTerms(p, keywords)}</li>`).join('')}</ul>`
    : '';

  return `
    <section class="card card--notes">
      <div class="summary-header">
        <h2>Summary</h2>
        <button id="copy-btn" class="btn btn--ghost btn--sm">Copy</button>
      </div>
      <div class="notes">
        <div class="notes-block">
          <h3 class="notes-heading">Overview</h3>
          <div class="notes-overview">${overviewHtml}</div>
        </div>
        ${s.points.length ? `
          <div class="notes-block">
            <h3 class="notes-heading">Key Points</h3>
            ${pointsHtml}
          </div>
        ` : ''}
      </div>
    </section>

    ${extractedPreview ? `
      <details class="card card--collapsible">
        <summary>Extracted text preview</summary>
        <div class="preview">${escapeHtml(extractedPreview)}</div>
      </details>
    ` : ''}
  `;
}

function bindEvents() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const installBtn = document.getElementById('install-btn');
  const copyBtn = document.getElementById('copy-btn');
  const retryBtn = document.getElementById('retry-btn');

  dropzone?.addEventListener('click', () => {
    if (state !== 'processing') fileInput?.click();
  });

  dropzone?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state !== 'processing') fileInput?.click();
    }
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dropzone--active');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dropzone--active');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dropzone--active');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
  });

  copyBtn?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(summaryResult);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  });

  retryBtn?.addEventListener('click', () => {
    state = 'idle';
    errorMessage = '';
    render();
  });

  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    }
  });
}

async function handleFile(file) {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    state = 'error';
    errorMessage = 'Please upload a PDF file.';
    render();
    return;
  }

  state = 'processing';
  summaryResult = '';
  errorMessage = '';
  render();

  const statusEl = () => document.getElementById('process-status');

  try {
    statusEl()?.replaceChildren(document.createTextNode('Extracting text from PDF…'));
    const { text, pageCount, pages } = await extractTextFromPdf(file);

    if (!text.trim()) {
      throw new Error('Could not extract text from this PDF. It may be scanned/image-only.');
    }

    fileMeta = { name: file.name, size: file.size, pages: pageCount };
    extractedPreview = text.slice(0, 1500) + (text.length > 1500 ? '…' : '');
    render();

    summaryResult = await summarizeText(text, pages, ({ stage }) => {
      statusEl()?.replaceChildren(document.createTextNode(stage));
    });

    state = 'done';
    render();
  } catch (err) {
    state = 'error';
    errorMessage = err instanceof Error ? err.message : 'Processing failed';
    render();
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** @type {BeforeInstallPromptEvent | null} */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = false;
});

window.addEventListener('online', render);
window.addEventListener('offline', render);

render();
