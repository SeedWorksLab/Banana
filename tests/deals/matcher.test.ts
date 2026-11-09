import {
  bestIngredientMatch,
  matchIngredients,
  type MatcherIngredient,
} from '../../src/deals/matcher';

const ingredients: MatcherIngredient[] = [
  { id: 1, name: 'Milk', aliases: ['Vollmilch', 'Milch'] },
  { id: 2, name: 'Banana', aliases: ['Bananen'] },
  { id: 3, name: 'Tomato', aliases: ['Rispentomaten', 'Tomaten'] },
  { id: 4, name: 'Chicken breast', aliases: ['Hühnerfilet', 'Hähnchenbrust'] },
  { id: 5, name: 'Ham', aliases: [] },
];

describe('matchIngredients', () => {
  it('matches a German alias to the canonical ingredient', () => {
    const matches = matchIngredients('Bio Vollmilch 1 l', ingredients);
    expect(matches[0]).toMatchObject({ ingredientId: 1 });
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('matches an inflected alias by token overlap', () => {
    const matches = matchIngredients('Bio Bananen', ingredients);
    expect(matches[0].ingredientId).toBe(2);
  });

  it('prefers the more specific ingredient and orders by confidence', () => {
    const matches = matchIngredients('Hühnerfilet', ingredients);
    expect(matches[0].ingredientId).toBe(4);
    for (let index = 1; index < matches.length; index += 1) {
      expect(matches[index - 1].confidence).toBeGreaterThanOrEqual(matches[index].confidence);
    }
  });

  it('does not use naive substring matching', () => {
    const matches = matchIngredients('Hamburger buns', ingredients);
    expect(matches.find((match) => match.ingredientId === 5)).toBeUndefined();
  });

  it('returns nothing when no ingredient is present', () => {
    expect(matchIngredients('Küchenrolle', ingredients)).toEqual([]);
  });

  it('exposes the single best match', () => {
    expect(bestIngredientMatch('Rispentomaten 500 g', ingredients)?.ingredientId).toBe(3);
    expect(bestIngredientMatch('Küchenrolle', ingredients)).toBeNull();
  });
});
