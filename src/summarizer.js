import {
  analyzeDocument,
  buildOverview,
  formatStudySummary,
  selectMainPoints,
} from './extract.js';

/**
 * Pick representative pages across the document.
 * @param {string[]} pages
 * @returns {string[]}
 */
function selectRepresentativePages(pages) {
  const cleaned = pages.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (cleaned.length <= 10) return cleaned;

  const picked = new Set([0, 1, cleaned.length - 1, cleaned.length - 2]);
  const step = (cleaned.length - 1) / 7;

  for (let i = 0; i < 7; i++) {
    picked.add(Math.min(cleaned.length - 1, Math.round(i * step)));
  }

  return [...picked].sort((a, b) => a - b).map((i) => cleaned[i]);
}

/** Summaries use local text analysis — no model download needed. */
export function isModelLoaded() {
  return true;
}

/** @deprecated Model no longer required; kept for API compatibility. */
export async function loadModel(onProgress) {
  onProgress?.({ status: 'Ready', progress: 100 });
}

/**
 * Build a concise study-notes summary using original PDF sentences.
 * @param {string} text
 * @param {string[]} pages
 * @param {(progress: { stage: string }) => void} onProgress
 * @returns {Promise<string>}
 */
export async function summarizeText(text, pages, onProgress) {
  const allPages = pages.length ? pages : [text];
  const sampledPages = selectRepresentativePages(allPages);

  onProgress({ stage: 'Reading document…' });

  const { sentences, keywords } = analyzeDocument(sampledPages);
  if (sentences.length === 0) throw new Error('No text to summarize');

  onProgress({ stage: 'Building summary…' });

  const overview = buildOverview(allPages, keywords);
  const exclude = new Set(overview);
  const points = selectMainPoints(sentences, keywords, exclude);

  return formatStudySummary({ overview, points });
}

export { parseStudySummary, highlightTerms, topKeywords } from './extract.js';
