import { matchTicketLines, parseTicketText } from '../../src/services/ticket-service';

describe('parseTicketText', () => {
  it('keeps product lines and strips prices and quantities', () => {
    const lines = parseTicketText(
      [
        'LIDL FILIALE 1234',
        'Datum: 09.11.2026 18:42',
        '2 x Bio Bananen 1,99 B',
        'Vollmilch 3,5% 1,29 A',
        'SUMME EUR 3,28',
        'Kartenzahlung 3,28',
      ].join('\n')
    );
    expect(lines).toEqual(['Bio Bananen', 'Vollmilch 3,5%']);
  });

  it('removes article codes and de-duplicates repeated items', () => {
    const lines = parseTicketText('123456 Butter 2,49\nButter 2,49\n');
    expect(lines).toEqual(['Butter']);
  });

  it('ignores empty input', () => {
    expect(parseTicketText('')).toEqual([]);
  });
});

describe('matchTicketLines', () => {
  const ingredients = [
    { id: 1, name: 'Banana' },
    { id: 2, name: 'Whole milk' },
    { id: 3, name: 'Butter' },
  ];

  it('matches receipt lines to known ingredients', () => {
    const matches = matchTicketLines(['Bio Bananen', 'Butter', 'Shampoo'], ingredients);
    expect(matches).toEqual([
      { line: 'Bio Bananen', ingredientId: 1, ingredientName: 'Banana' },
      { line: 'Butter', ingredientId: 3, ingredientName: 'Butter' },
      { line: 'Shampoo', ingredientId: null, ingredientName: null },
    ]);
  });

  it('does not match on a single generic word from a multi-word ingredient', () => {
    const matches = matchTicketLines(['Milk chocolate'], [{ id: 2, name: 'Whole milk' }]);
    expect(matches[0].ingredientId).toBeNull();
  });
});
