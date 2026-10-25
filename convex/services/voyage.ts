import { EMBEDDING } from "../lib/config";

// The one module that talks to Voyage (CLAUDE.md §6.3). Call it only from actions.
// Students' taste documents are embedded as "query", events as "document", so they share one space.

type VoyageResponse = { data: { embedding: number[]; index: number }[] };

export async function embed(texts: string[], inputType: "query" | "document"): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set on this Convex deployment");
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING.model,
      input: texts,
      input_type: inputType,
      output_dimension: EMBEDDING.dimensions,
    }),
  });
  if (!response.ok) {
    throw new Error(`Voyage embeddings failed with ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as VoyageResponse;
  return [...body.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
}
