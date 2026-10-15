export interface WhatsNewEntry {
  version: string;
  releasedAt: string;
  items: string[];
}

export const whatsNew: WhatsNewEntry[] = [
  {
    version: '0.1.0',
    releasedAt: '2026-10-15T00:00:00.000Z',
    items: [
      'Plan next week of meals around how much time you actually have each day.',
      'Pin anything you specifically want to eat; Banana fills the rest.',
      'Turn the plan into one organised shopping list, grouped by aisle.',
      'See the current offers at Lidl, Hofer and Spar and where they save you the most.',
      'Everything is stored locally. No account, no cloud, no tracking.',
    ],
  },
];
