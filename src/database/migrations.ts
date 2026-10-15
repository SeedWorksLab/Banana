import { SCHEMA_SQL, SEED_STORES_SQL } from './schema';

export interface Migration {
  id: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Initial schema',
    sql: `
${SCHEMA_SQL}

${SEED_STORES_SQL}
`,
  },
];
