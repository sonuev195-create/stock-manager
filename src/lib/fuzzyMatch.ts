/**
 * Fuzzy matching utility for matching items with slight variations
 */

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarityScore(a: string, b: string): number {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  
  if (normalizedA === normalizedB) return 1;
  
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - (distance / maxLength);
}

export interface MatchResult<T> {
  item: T;
  score: number;
  matchType: 'exact' | 'startsWith' | 'contains' | 'fuzzy';
}

export function findBestMatch<T>(
  searchText: string,
  items: T[],
  getSearchFields: (item: T) => string[],
  minScore = 0.6
): MatchResult<T> | null {
  if (!searchText || items.length === 0) return null;

  const normalizedSearch = normalizeText(searchText);
  let bestMatch: MatchResult<T> | null = null;

  for (const item of items) {
    const fields = getSearchFields(item);
    
    for (const field of fields) {
      if (!field) continue;
      const normalizedField = normalizeText(field);

      // Priority 1: Exact match
      if (normalizedField === normalizedSearch) {
        return { item, score: 1, matchType: 'exact' };
      }

      // Priority 2: Starts with
      if (normalizedField.startsWith(normalizedSearch) || normalizedSearch.startsWith(normalizedField)) {
        const score = 0.9 + (0.1 * (Math.min(normalizedField.length, normalizedSearch.length) / Math.max(normalizedField.length, normalizedSearch.length)));
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { item, score, matchType: 'startsWith' };
        }
        continue;
      }

      // Priority 3: Contains
      if (normalizedField.includes(normalizedSearch) || normalizedSearch.includes(normalizedField)) {
        const score = 0.75 + (0.15 * (Math.min(normalizedField.length, normalizedSearch.length) / Math.max(normalizedField.length, normalizedSearch.length)));
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { item, score, matchType: 'contains' };
        }
        continue;
      }

      // Priority 4: Fuzzy match (Levenshtein)
      const score = similarityScore(field, searchText);
      if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { item, score, matchType: 'fuzzy' };
      }
    }
  }

  return bestMatch;
}

export function findAllMatches<T>(
  searchText: string,
  items: T[],
  getSearchFields: (item: T) => string[],
  minScore = 0.6,
  limit = 5
): MatchResult<T>[] {
  if (!searchText || items.length === 0) return [];

  const results: MatchResult<T>[] = [];
  
  for (const item of items) {
    const fields = getSearchFields(item);
    let itemBestScore = 0;
    let itemMatchType: 'exact' | 'startsWith' | 'contains' | 'fuzzy' = 'fuzzy';

    for (const field of fields) {
      if (!field) continue;
      const normalizedSearch = normalizeText(searchText);
      const normalizedField = normalizeText(field);

      if (normalizedField === normalizedSearch) {
        itemBestScore = 1;
        itemMatchType = 'exact';
        break;
      }

      if (normalizedField.startsWith(normalizedSearch) || normalizedSearch.startsWith(normalizedField)) {
        const score = 0.9 + (0.1 * (Math.min(normalizedField.length, normalizedSearch.length) / Math.max(normalizedField.length, normalizedSearch.length)));
        if (score > itemBestScore) {
          itemBestScore = score;
          itemMatchType = 'startsWith';
        }
        continue;
      }

      if (normalizedField.includes(normalizedSearch) || normalizedSearch.includes(normalizedField)) {
        const score = 0.75 + (0.15 * (Math.min(normalizedField.length, normalizedSearch.length) / Math.max(normalizedField.length, normalizedSearch.length)));
        if (score > itemBestScore) {
          itemBestScore = score;
          itemMatchType = 'contains';
        }
        continue;
      }

      const score = similarityScore(field, searchText);
      if (score > itemBestScore) {
        itemBestScore = score;
        itemMatchType = 'fuzzy';
      }
    }

    if (itemBestScore >= minScore) {
      results.push({ item, score: itemBestScore, matchType: itemMatchType });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
