export interface MatcherIngredient {
  id: number;
  name: string;
  aliases: readonly string[];
}

export interface IngredientMatch {
  ingredientId: number;
  confidence: number;
  matchedOn: string;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'fresh',
  'bio',
  'per',
  'of',
  'a',
  'an',
  'kg',
  'g',
  'mg',
  'ml',
  'l',
  'stk',
  'stück',
  'stueck',
  'pack',
  'packung',
  'frisch',
  'aus',
  'von',
  'der',
  'die',
  'das',
  'und',
  'mit',
  'je',
]);

/** Lowercase, de-accent and reduce to word tokens so "Frühlingszwiebel" ≈ "fxühlingszwiebel". */
export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ß ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  const normalized = normalizeTerm(value);
  if (normalized === '') {
    return [];
  }
  return normalized.split(' ').filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function scoreTerm(productTokens: readonly string[], productNormalized: string, term: string): number {
  const termTokens = tokenize(term);
  if (termTokens.length === 0) {
    return 0;
  }
  if (normalizeTerm(term) === productNormalized) {
    return 1;
  }
  const shared = termTokens.filter((token) => productTokens.includes(token)).length;
  if (shared === 0) {
    return 0;
  }
  const coverage = shared / termTokens.length;
  if (coverage < 0.5) {
    return 0;
  }
  if (shared === termTokens.length) {
    // The whole ingredient name appears in the product; confidence rises when
    // the product is not much more than the ingredient.
    return 0.82 + 0.16 * (termTokens.length / Math.max(productTokens.length, 1));
  }
  return 0.5 + 0.45 * coverage;
}

/**
 * Maps a deal product name to canonical ingredients using names and aliases.
 * Matching is token-based, not a naive substring, so "milk" does not match
 * every product whose label happens to contain the letters, and a brand word
 * cannot drown out the ingredient. Pure, deterministic, and always reviewable.
 */
export function matchIngredients(
  productName: string,
  ingredients: readonly MatcherIngredient[],
  threshold = 0.62
): IngredientMatch[] {
  const productTokens = tokenize(productName);
  const productNormalized = normalizeTerm(productName);
  if (productTokens.length === 0) {
    return [];
  }

  const matches: IngredientMatch[] = [];
  for (const ingredient of ingredients) {
    let best: IngredientMatch | null = null;
    for (const term of [ingredient.name, ...ingredient.aliases]) {
      const confidence = scoreTerm(productTokens, productNormalized, term);
      if (confidence > 0 && (best === null || confidence > best.confidence)) {
        best = { ingredientId: ingredient.id, confidence, matchedOn: term };
      }
    }
    if (best !== null && best.confidence >= threshold) {
      matches.push({ ...best, confidence: Math.round(best.confidence * 100) / 100 });
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence || a.ingredientId - b.ingredientId);
  return matches;
}

export function bestIngredientMatch(
  productName: string,
  ingredients: readonly MatcherIngredient[],
  threshold = 0.62
): IngredientMatch | null {
  return matchIngredients(productName, ingredients, threshold)[0] ?? null;
}
