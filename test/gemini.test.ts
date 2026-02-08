import { describe, expect, test } from 'bun:test';
import { extractJson, parseGlobalReview, parseReviews, sanitizeText } from '../src/gemini.js';

describe('Gemini Response Parsing', () => {
  describe('sanitizeText', () => {
    test('removes control characters', () => {
      const input = 'Hello\u0000World';
      expect(sanitizeText(input)).toBe('HelloWorld');
    });

    test('trims whitespace', () => {
      const input = '  Hello World  ';
      expect(sanitizeText(input)).toBe('Hello World');
    });

    test('handles normal text', () => {
      const input = 'Normal Text';
      expect(sanitizeText(input)).toBe('Normal Text');
    });
  });

  describe('extractJson', () => {
    test('extracts json from markdown code block', () => {
      const input = '```json\n{"foo": "bar"}\n```';
      expect(extractJson(input)).toBe('{"foo": "bar"}');
    });

    test('extracts json from plain code block', () => {
      const input = '```\n{"foo": "bar"}\n```';
      expect(extractJson(input)).toBe('{"foo": "bar"}');
    });

    test('extracts json surrounded by text', () => {
      const input = 'Here is the json:\n```json\n{"foo": "bar"}\n```\nHope that helps.';
      expect(extractJson(input)).toBe('{"foo": "bar"}');
    });

    test('extracts raw json without code blocks', () => {
      const input = '{"foo": "bar"}';
      expect(extractJson(input)).toBe('{"foo": "bar"}');
    });

    test('extracts json from noisy chatty response', () => {
      const input = `
        Here is the analysis of your code.
        Overall it looks good, but there are some issues.
        {
          "reviews": [
            { "lineNumber": 10, "reviewComment": "Fix this" }
          ]
        }
        Let me know if you need more help!
      `;

      const extracted = extractJson(input);
      const parsed = JSON.parse(extracted);
      expect(parsed.reviews).toHaveLength(1);
      expect(parsed.reviews[0].lineNumber).toBe(10);
    });
  });

  describe('parseReviews', () => {
    test('parses valid reviews', () => {
      const input = JSON.stringify({
        reviews: [{ lineNumber: 10, reviewComment: 'Fix this', priority: 'high', category: 'bug' }],
      });
      const result = parseReviews(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        lineNumber: 10,
        reviewComment: 'Fix this',
        priority: 'high',
        category: 'bug',
      });
    });

    test('handles malformed json gracefully', () => {
      const input = 'invalid json';
      expect(parseReviews(input)).toEqual([]);
    });

    test('filters out reviews with invalid line numbers', () => {
      const input = JSON.stringify({
        reviews: [
          { lineNumber: 0, reviewComment: 'Invalid line' },
          { lineNumber: -1, reviewComment: 'Invalid line' },
          { lineNumber: 'NaN', reviewComment: 'Invalid line' },
          { lineNumber: 5, reviewComment: 'Valid line' },
        ],
      });
      const result = parseReviews(input);
      expect(result).toHaveLength(1);
      expect(result[0]?.lineNumber).toBe(5);
    });

    test('filters out reviews with empty comments', () => {
      const input = JSON.stringify({
        reviews: [
          { lineNumber: 5, reviewComment: '' },
          { lineNumber: 6, reviewComment: '   ' },
          { lineNumber: 7, reviewComment: 'Valid' },
        ],
      });
      const result = parseReviews(input);
      expect(result).toHaveLength(1);
      expect(result[0]?.reviewComment).toBe('Valid');
    });

    test('normalizes priority', () => {
      const input = JSON.stringify({
        reviews: [
          { lineNumber: 1, reviewComment: 'test', priority: 'Urgent' },
          { lineNumber: 2, reviewComment: 'test', priority: 'LOW' },
        ],
      });
      const result = parseReviews(input);
      expect(result[0]?.priority).toBe('medium'); // Default fallback
      expect(result[1]?.priority).toBe('low');
    });
  });

  describe('parseGlobalReview', () => {
    test('parses valid global review', () => {
      const input = JSON.stringify({
        summary: 'Good work',
        findings: ['Issue 1', 'Issue 2'],
      });
      const result = parseGlobalReview(input);
      expect(result.summary).toBe('Good work');
      expect(result.findings).toEqual(['Issue 1', 'Issue 2']);
    });

    test('handles object findings (legacy/alternative structure)', () => {
      const input = JSON.stringify({
        summary: 'Summary',
        findings: [
          { title: 'Title 1', details: 'Details 1' },
          { title: 'Title 2' },
          { details: 'Details 3' },
        ],
      });
      const result = parseGlobalReview(input);
      expect(result.findings).toEqual(['Title 1: Details 1', 'Title 2', 'Details 3']);
    });

    test('falls back to crossFileFindings', () => {
      const input = JSON.stringify({
        summary: 'Summary',
        crossFileFindings: ['Cross file issue'],
      });
      const result = parseGlobalReview(input);
      expect(result.findings).toEqual(['Cross file issue']);
    });

    test('returns empty structure on failure', () => {
      const result = parseGlobalReview('invalid');
      expect(result).toEqual({ summary: '', findings: [] });
    });
  });
});
