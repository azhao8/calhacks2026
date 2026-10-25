// Test doubles: a scripted model behind the real SDK, and a stub web.

type Step = { tool: string; input: unknown } | { text: string };

export function scriptedFetch(steps: Step[]): { fetch: typeof fetch; requests: Record<string, unknown>[] } {
  const requests: Record<string, unknown>[] = [];
  let index = 0;
  const fake = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")));
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;
    const content =
      "tool" in step
        ? [{ type: "tool_use", id: `toolu_${index}`, name: step.tool, input: step.input }]
        : [{ type: "text", text: step.text }];
    const body = {
      id: `msg_${index}`,
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content,
      stop_reason: "tool" in step ? "tool_use" : "end_turn",
      stop_sequence: null,
      stop_details: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", "request-id": `req_${index}` } });
  }) as typeof fetch;
  return { fetch: fake, requests };
}

export const FOX_SEARCH = [
  {
    osm_type: "way",
    osm_id: 222,
    lat: "37.8080",
    lon: "-122.2703",
    name: "Fox Theater",
    display_name: "Fox Theater, 1807, Telegraph Avenue, Oakland, California, USA",
    category: "amenity",
    type: "theatre",
  },
];

type StubPage = { status?: number; body: string; type?: string };

export function stubWebFetch(options: {
  nominatim?: unknown[];
  robots?: Record<string, string>;
  pages?: Record<string, StubPage>;
  calls?: string[];
}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    options.calls?.push(url);
    if (url.startsWith("https://nominatim.openstreetmap.org/")) {
      return new Response(JSON.stringify(options.nominatim ?? []), { status: 200 });
    }
    const parsed = new URL(url);
    if (parsed.pathname === "/robots.txt") {
      const robots = options.robots?.[parsed.origin];
      return robots === undefined ? new Response("", { status: 404 }) : new Response(robots, { status: 200 });
    }
    const page = options.pages?.[url];
    if (!page) return new Response("not found", { status: 404 });
    return new Response(page.body, { status: page.status ?? 200, headers: { "content-type": page.type ?? "text/html" } });
  }) as typeof fetch;
}
