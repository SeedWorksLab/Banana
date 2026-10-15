import type { SQLiteDatabase } from 'expo-sqlite';
import type { AiState } from '../models';
import { getDatabase } from './database';

export const DEFAULT_AI_STATE: AiState = {
  llmBaseUrl: null,
  llmApiKey: null,
  llmModel: null,
  enabled: false,
  lastError: null,
};

interface AiStateRow {
  llm_base_url: string | null;
  llm_api_key: string | null;
  llm_model: string | null;
  enabled: number;
  last_error: string | null;
}

function rowToAiState(row: AiStateRow): AiState {
  return {
    llmBaseUrl: row.llm_base_url,
    llmApiKey: row.llm_api_key,
    llmModel: row.llm_model,
    enabled: row.enabled === 1,
    lastError: row.last_error,
  };
}

export async function getAiState(db?: SQLiteDatabase): Promise<AiState> {
  const database = db ?? (await getDatabase());
  await database.runAsync('INSERT OR IGNORE INTO ai_state (id) VALUES (1)');
  const row = await database.getFirstAsync<AiStateRow>(
    `SELECT llm_base_url, llm_api_key, llm_model, enabled, last_error
       FROM ai_state
      WHERE id = 1`
  );
  return row ? rowToAiState(row) : { ...DEFAULT_AI_STATE };
}

export async function updateAiState(
  patch: Partial<AiState>,
  db?: SQLiteDatabase
): Promise<AiState> {
  const database = db ?? (await getDatabase());
  const next: AiState = { ...(await getAiState(database)), ...patch };
  await database.runAsync(
    `UPDATE ai_state
        SET llm_base_url = ?, llm_api_key = ?, llm_model = ?, enabled = ?, last_error = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = 1`,
    [next.llmBaseUrl, next.llmApiKey, next.llmModel, next.enabled ? 1 : 0, next.lastError]
  );
  return next;
}

export async function clearAiCredentials(db?: SQLiteDatabase): Promise<AiState> {
  return updateAiState({ llmApiKey: null }, db);
}

export function isLlmConfigured(state: AiState): boolean {
  return Boolean(state.enabled && state.llmBaseUrl && state.llmModel && state.llmApiKey);
}
