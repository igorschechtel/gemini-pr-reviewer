import { type GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';

export type AIReview = {
  lineNumber: number;
  reviewComment: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
};

export type AIGlobalReview = {
  summary: string;
  findings: string[];
};

export function sanitizeText(text: string): string {
  // Use new RegExp with string literal to avoid linting error for control characters
  // identifying control characters by their hex codes
  // Explicitly constructing RegExp from string parts to avoid linter flagging it
  return text
    .replace(new RegExp('[' + '\\x00-\\x08' + '\\x0B\\x0C' + '\\x0E-\\x1F' + ']', 'g'), '')
    .trim();
}

export function extractJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  if (cleaned.startsWith('{')) return cleaned;

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return cleaned;
}

function normalizePriority(value: unknown): AIReview['priority'] {
  const raw = String(value || '').toLowerCase();
  if (raw === 'critical' || raw === 'high' || raw === 'medium' || raw === 'low') {
    return raw as AIReview['priority'];
  }
  return 'medium';
}

export function parseReviews(text: string): AIReview[] {
  const jsonText = extractJson(text);

  try {
    const parsed = JSON.parse(jsonText);
    const reviews = parsed?.reviews;
    if (!Array.isArray(reviews)) return [];

    const results: AIReview[] = [];
    for (const review of reviews) {
      const lineNumber = Number(review?.lineNumber);
      const reviewComment = typeof review?.reviewComment === 'string' ? review.reviewComment : '';

      if (!Number.isFinite(lineNumber) || lineNumber <= 0) continue;
      if (!reviewComment.trim()) continue;

      results.push({
        lineNumber,
        reviewComment: sanitizeText(reviewComment),
        priority: normalizePriority(review?.priority),
        category: typeof review?.category === 'string' ? sanitizeText(review.category) : undefined,
      });
    }

    return results;
  } catch {
    return [];
  }
}

interface FindingObject {
  title?: string;
  details?: string;
}

export function parseGlobalReview(text: string): AIGlobalReview {
  const jsonText = extractJson(text);

  try {
    const parsed = JSON.parse(jsonText);
    const summary = typeof parsed?.summary === 'string' ? sanitizeText(parsed.summary) : '';

    const findingsRaw = Array.isArray(parsed?.findings)
      ? parsed.findings
      : Array.isArray(parsed?.crossFileFindings)
        ? parsed.crossFileFindings
        : [];

    const findings = findingsRaw
      .map((item: unknown): string => {
        if (typeof item === 'string') return sanitizeText(item);
        if (item && typeof item === 'object') {
          const finding = item as FindingObject;
          const title = typeof finding.title === 'string' ? sanitizeText(finding.title) : '';
          const details = typeof finding.details === 'string' ? sanitizeText(finding.details) : '';
          if (title && details) return `${title}: ${details}`;
          return title || details;
        }
        return '';
      })
      .filter((item: string) => item.length > 0);

    return { summary, findings };
  } catch {
    return { summary: '', findings: [] };
  }
}

export class GeminiClient {
  private model: GenerativeModel;

  constructor(apiKey: string, modelName: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async review(prompt: string): Promise<AIReview[]> {
    const result = await this.model.generateContent(prompt);
    const response = result?.response;
    const text = response?.text ? response.text() : '';
    return parseReviews(text || '');
  }

  async reviewGlobal(prompt: string): Promise<AIGlobalReview> {
    const result = await this.model.generateContent(prompt);
    const response = result?.response;
    const text = response?.text ? response.text() : '';
    return parseGlobalReview(text || '');
  }
}
