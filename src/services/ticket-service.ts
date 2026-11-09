export interface TicketIngredient {
  id: number;
  name: string;
}

export interface TicketMatch {
  line: string;
  ingredientId: number | null;
  ingredientName: string | null;
}

const SKIP_LINE = /^(lidl|hofer|spar|total|summe|gesamt|zwischensumme|filiale|steuer|tax|mwst|ust|uid|datum|date|zeit|time|store|kasse|tel|www|http|https|iban|betrag|rückgeld|rueckgeld|gegeben|karte|bar|visa|mastercard|debit|bon|rechnung|artikel|menge|preis|zu zahlen|einkauf|öffnungszeit|oeffnungszeit|servicenummer)/i;
const TRAILING_PRICE = /\s+\d{1,3}(?:[.,]\d{2})\s*[A-Z]?$/;
const LEADING_QUANTITY = /^\d+\s*[x×]\s*/i;
const LEADING_CODE = /^\d{5,}\s+/;
const STOPWORDS = new Set([
  'bio',
  'frisch',
  'frische',
  'packung',
  'stk',
  'stück',
  'stueck',
  'kg',
  'g',
  'l',
  'ml',
  'x',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * Reads a shared Lidl receipt and keeps the product lines. Totals, tax rows,
 * payment methods and timestamps are dropped; prices and quantity prefixes are
 * stripped so only the item name remains.
 */
export function parseTicketText(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(/^[*•-]+\s*/, '');
    if (line.length < 2 || !/[a-zäöüß]/i.test(line) || SKIP_LINE.test(line)) {
      continue;
    }
    line = line.replace(LEADING_CODE, '').replace(LEADING_QUANTITY, '').replace(TRAILING_PRICE, '').trim();
    if (line.length < 2 || !/[a-zäöüß]/i.test(line)) {
      continue;
    }
    const key = normalize(line);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(line);
  }
  return lines;
}

function tokenMatches(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  let common = 0;
  const limit = Math.min(left.length, right.length);
  while (common < limit && left[common] === right[common]) {
    common += 1;
  }
  return common >= 4 && common >= limit * 0.6;
}

/**
 * Maps receipt lines to known ingredients by token overlap. An ingredient must
 * cover most of its own words in the line, so "milk" does not match every
 * product that merely contains the word.
 */
export function matchTicketLines(
  lines: readonly string[],
  ingredients: readonly TicketIngredient[]
): TicketMatch[] {
  const ingredientTokens = ingredients.map((ingredient) => ({
    ingredient,
    tokens: tokens(ingredient.name),
  }));

  return lines.map((line) => {
    const lineTokens = tokens(line);
    let best: { ingredient: TicketIngredient; score: number } | null = null;
    for (const candidate of ingredientTokens) {
      if (candidate.tokens.length === 0) {
        continue;
      }
      const matched = candidate.tokens.filter((token) =>
        lineTokens.some((lineToken) => tokenMatches(token, lineToken))
      ).length;
      const score = matched / candidate.tokens.length;
      if (matched > 0 && score >= 0.6 && (best === null || score > best.score)) {
        best = { ingredient: candidate.ingredient, score };
      }
    }
    return {
      line,
      ingredientId: best?.ingredient.id ?? null,
      ingredientName: best?.ingredient.name ?? null,
    };
  });
}
