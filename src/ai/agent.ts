import {
  parseNewspaperResponse,
  parsePlanEditResponse,
  parseRecipeExtractionResponse,
  type PlanEditContext,
  buildPlanEditContext,
} from './planner';
import {
  NEWSPAPER_PROMPT,
  PLAN_EDIT_PROMPT,
  RECIPE_EXTRACTION_PROMPT,
  type PromptTemplate,
} from './prompts';
import type { AiProvider } from './provider';
import type {
  NewspaperExtractionResult,
  PlanEditResult,
  RecipeExtractionResult,
} from './schemas';

const MAX_STORED_REQUEST = 4_000;
const MAX_STORED_RESPONSE = 8_000;

export interface AgentRunMeta {
  promptId: string;
  promptVersion: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  requestText: string;
  responseText: string;
}

export interface AgentResult<T> {
  value: T;
  meta: AgentRunMeta;
}

async function run<T>(
  provider: AiProvider,
  prompt: PromptTemplate,
  userContent: string,
  parse: (text: string) => T
): Promise<AgentResult<T>> {
  const completion = await provider.complete({
    temperature: 0.2,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: userContent },
    ],
  });
  return {
    value: parse(completion.text),
    meta: {
      promptId: prompt.id,
      promptVersion: prompt.version,
      model: completion.model,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      requestText: userContent.slice(0, MAX_STORED_REQUEST),
      responseText: completion.text.slice(0, MAX_STORED_RESPONSE),
    },
  };
}

export function planEditUserMessage(context: PlanEditContext, instruction: string): string {
  return `Current plan context:\n${buildPlanEditContext(context)}\n\nUser request:\n${instruction}`;
}

export async function runPlanEdit(
  provider: AiProvider,
  context: PlanEditContext,
  instruction: string
): Promise<AgentResult<PlanEditResult>> {
  return run(provider, PLAN_EDIT_PROMPT, planEditUserMessage(context, instruction), parsePlanEditResponse);
}

export async function runRecipeExtraction(
  provider: AiProvider,
  transcript: string
): Promise<AgentResult<RecipeExtractionResult>> {
  return run(
    provider,
    RECIPE_EXTRACTION_PROMPT,
    `Dictated recipe:\n${transcript}`,
    parseRecipeExtractionResponse
  );
}

export async function runNewspaperExtraction(
  provider: AiProvider,
  transcript: string,
  context: PlanEditContext
): Promise<AgentResult<NewspaperExtractionResult>> {
  return run(
    provider,
    NEWSPAPER_PROMPT,
    `Known homes and pantry:\n${buildPlanEditContext(context)}\n\nDictated leaflet:\n${transcript}`,
    parseNewspaperResponse
  );
}
