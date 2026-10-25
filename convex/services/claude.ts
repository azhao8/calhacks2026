import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { MODELS } from "../lib/config";

// The one module that talks to Claude (CLAUDE.md §7, §8.1). Call it only from actions.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export class ClaudeRefusalError extends Error {
  constructor(public readonly category: string | null) {
    super(`Claude declined the request${category ? ` (${category})` : ""}`);
  }
}

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client === null) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on this Convex deployment");
    client = new Anthropic({ apiKey });
  }
  return client;
}

// One validated JSON answer. Server-side refusal fallback is on, so a policy decline retries on another model.
export async function generateJson<Schema extends z.ZodType>(options: {
  schema: Schema;
  system: string;
  prompt: string;
  effort: Effort;
  maxTokens?: number;
  model?: string;
}): Promise<z.infer<Schema>> {
  const response = await anthropic().beta.messages.parse({
    model: options.model ?? MODELS.default,
    max_tokens: options.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    output_config: { effort: options.effort, format: betaZodOutputFormat(options.schema) },
  });
  if (response.stop_reason === "refusal") {
    throw new ClaudeRefusalError(response.stop_details?.category ?? null);
  }
  if (response.parsed_output === null || response.parsed_output === undefined) {
    throw new Error("Claude's answer didn't match the expected format");
  }
  return response.parsed_output as z.infer<Schema>;
}
