const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
  'you', 'your', 'he', 'she', 'his', 'her', 'not', 'no', 'can', 'also', 'than', 'then',
  'when', 'where', 'which', 'who', 'what', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'only', 'same', 'so', 'too', 'very', 'just',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'again', 'further', 'once', 'here', 'there', 'any', 'both', 'own', 'same',
  'page', 'figure', 'table', 'section', 'chapter', 'see', 'shown', 'using', 'used',
]);

const NUMERIC_RE = /\d[\d,]*(?:\.\d+)?(?:\s*(?:%|percent|percentage))?|\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:billion|million|trillion|bn|mn|b|m|k))?|\b(?:19|20)\d{2}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi;

const ACTION_RE = /\b(conclude|conclusion|result|finding|recommend|important|significant|key|main|primary|goal|objective|purpose|demonstrate|show(?:s|ed)?|increase|decrease|growth|decline|impact|effect|overall|summary|because|therefore|however)\b/i;

/**
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const raw = normalized.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [normalized];
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 280);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function topKeywords(text, limit = 6) {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const freq = new Map();

  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * @param {string} pageText
 * @returns {string}
 */
function detectTitle(pageText) {
  const lines = pageText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) =>
    l.length >= 8 && l.length <= 120 && !l.endsWith('.') && !/^\d+$/.test(l),
  ) ?? '';
}

/**
 * @param {string} sentence
 * @param {Set<string>} keywords
 * @param {number} index
 * @param {number} total
 */
function scoreSentence(sentence, keywords, index, total) {
  const lower = sentence.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    if (lower.includes(kw)) score += 3;
  }
  if (ACTION_RE.test(sentence)) score += 3;
  NUMERIC_RE.lastIndex = 0;
  if (NUMERIC_RE.test(sentence)) score += 4;
  if (index < 6) score += 2;
  if (index >= total - 5) score += 2;
  if (sentence.length >= 40 && sentence.length <= 160) score += 2;

  return score;
}

/**
 * @param {string[]} sentences
 * @returns {string[]}
 */
function dedupeSentences(sentences) {
  const seen = [];
  const result = [];

  for (const s of sentences) {
    const key = s.toLowerCase().slice(0, 50);
    if (seen.some((k) => key.includes(k.slice(0, 25)) || k.includes(key.slice(0, 25)))) continue;
    seen.push(key);
    result.push(s);
  }

  return result;
}

/**
 * @param {string[]} pages
 * @returns {{ sentences: string[], keywords: string[] }}
 */
export function analyzeDocument(pages) {
  const fullText = pages.map((p) => p.replace(/\s+/g, ' ').trim()).join(' ');
  return { sentences: splitSentences(fullText), keywords: topKeywords(fullText) };
}

/**
 * Build a 2–3 line overview from the document intro (original wording).
 * @param {string[]} pages
 * @param {string[]} keywords
 * @returns {string[]}
 */
export function buildOverview(pages, keywords) {
  if (pages.length === 0) return [];

  const keywordSet = new Set(keywords);
  const lines = [];
  const title = detectTitle(pages[0]);

  if (title) {
    lines.push(title.endsWith('.') ? title : `${title}.`);
  }

  const introPool = splitSentences(pages.slice(0, 2).join(' '));
  const ranked = introPool
    .filter((s) => !title || !s.toLowerCase().includes(title.toLowerCase().slice(0, 15)))
    .map((s, i) => ({ sentence: s, score: scoreSentence(s, keywordSet, i, introPool.length) }))
    .sort((a, b) => b.score - a.score);

  for (const { sentence } of ranked) {
    if (lines.length >= 3) break;
    if (lines.some((l) => l.includes(sentence.slice(0, 30)))) continue;
    lines.push(sentence);
  }

  if (lines.length < 2 && pages.length > 2) {
    const closing = splitSentences(pages[pages.length - 1].replace(/\s+/g, ' '));
    const last = closing[closing.length - 1];
    if (last && !lines.includes(last)) lines.push(last);
  }

  return lines.slice(0, 3);
}

/**
 * Select 4–6 main-idea bullet points (original sentences from the PDF).
 * @param {string[]} sentences
 * @param {string[]} keywords
 * @param {Set<string>} exclude
 * @returns {string[]}
 */
export function selectMainPoints(sentences, keywords, exclude) {
  const keywordSet = new Set(keywords);

  const scored = sentences
    .filter((s) => !exclude.has(s))
    .map((s, i) => ({ sentence: s, score: scoreSentence(s, keywordSet, i, sentences.length) }))
    .filter((c) => c.score > 2)
    .sort((a, b) => b.score - a.score);

  const picked = dedupeSentences(scored.map((c) => c.sentence));
  const count = Math.min(6, Math.max(4, picked.length));
  return picked.slice(0, count);
}

/**
 * @param {{ overview: string[], points: string[] }} data
 * @returns {string}
 */
export function formatStudySummary(data) {
  const lines = ['OVERVIEW', ...data.overview, '', 'KEY POINTS'];
  for (const p of data.points) lines.push(`• ${p}`);
  return lines.join('\n').trim();
}

/**
 * @param {string} formatted
 * @returns {{ overview: string[], points: string[] }}
 */
export function parseStudySummary(formatted) {
  const result = { overview: [], points: [] };
  /** @type {'overview' | 'points' | null} */
  let section = null;

  for (const line of formatted.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'OVERVIEW') { section = 'overview'; continue; }
    if (trimmed === 'KEY POINTS') { section = 'points'; continue; }

    if (section === 'overview') result.overview.push(trimmed);
    else if (section === 'points' && trimmed.startsWith('•')) {
      result.points.push(trimmed.slice(1).trim());
    }
  }

  return result;
}

/**
 * Bold dates, numbers, and top keywords for study-note styling.
 * @param {string} text
 * @param {string[]} keywords
 * @returns {string}
 */
export function highlightTerms(text, keywords) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(
    /\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:billion|million|trillion|bn|mn|b|m|k))?|\d[\d,]*(?:\.\d+)?\s*%|\b(?:19|20)\d{2}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi,
    (m) => `<strong>${m}</strong>`,
  );

  for (const kw of keywords.slice(0, 4)) {
    const re = new RegExp(`\\b(${kw})\\b`, 'gi');
    html = html.replace(re, '<strong>$1</strong>');
  }

  return html;
}
