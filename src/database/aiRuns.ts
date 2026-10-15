import type { SQLiteDatabase } from 'expo-sqlite';
import { AI_RUN_KINDS, AI_RUN_STATUSES } from '../models';
import type { AiRun, AiRunKind, AiRunStatus } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface AiRunRow {
  id: number;
  uuid: string | null;
  week_id: number | null;
  kind: AiRunKind;
  prompt_id: string | null;
  prompt_version: string | null;
  model: string | null;
  status: AiRunStatus;
  request_summary: string | null;
  response_json: string | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate_cents: number | null;
  created_at: string;
  updated_at: string | null;
}

function parseKind(value: string): AiRunKind {
  return (AI_RUN_KINDS as readonly string[]).includes(value) ? (value as AiRunKind) : 'narrative';
}

function parseStatus(value: string): AiRunStatus {
  return (AI_RUN_STATUSES as readonly string[]).includes(value) ? (value as AiRunStatus) : 'failed';
}

function rowToAiRun(row: AiRunRow): AiRun {
  return {
    id: row.id,
    uuid: row.uuid,
    weekId: row.week_id,
    kind: parseKind(row.kind),
    promptId: row.prompt_id,
    promptVersion: row.prompt_version,
    model: row.model,
    status: parseStatus(row.status),
    requestSummary: row.request_summary,
    responseJson: row.response_json,
    error: row.error,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costEstimateCents: row.cost_estimate_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, week_id, kind, prompt_id, prompt_version, model, status,
                       request_summary, response_json, error, input_tokens, output_tokens,
                       cost_estimate_cents, created_at, updated_at
                  FROM ai_runs`;

export interface AiRunInput {
  weekId: number | null;
  kind: AiRunKind;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  status: AiRunStatus;
  requestSummary: string | null;
  responseJson: string | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimateCents: number | null;
}

export async function getAiRuns(limit = 50, db?: SQLiteDatabase): Promise<AiRun[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<AiRunRow>(
    `${SELECT} ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToAiRun);
}

export async function getAiRunsByWeek(
  weekId: number,
  db?: SQLiteDatabase
): Promise<AiRun[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<AiRunRow>(
    `${SELECT} WHERE week_id = ? ORDER BY created_at DESC`,
    [weekId]
  );
  return rows.map(rowToAiRun);
}

export async function createAiRun(
  input: AiRunInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO ai_runs
       (uuid, week_id, kind, prompt_id, prompt_version, model, status, request_summary,
        response_json, error, input_tokens, output_tokens, cost_estimate_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.weekId,
      input.kind,
      input.promptId,
      input.promptVersion,
      input.model,
      input.status,
      input.requestSummary,
      input.responseJson,
      input.error,
      input.inputTokens,
      input.outputTokens,
      input.costEstimateCents,
    ]
  );
  return result.lastInsertRowId;
}
