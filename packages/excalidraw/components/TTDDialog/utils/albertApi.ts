import { RequestError } from "../../../errors";

import type { LLMMessage, TTTDDialog } from "../types";

const DIAGRAM_SYSTEM_PROMPT = `You are an expert at creating Mermaid diagrams.
When asked to create a diagram, respond with ONLY the Mermaid diagram syntax, without any markdown code blocks, backticks, or explanations.
Start directly with the diagram type keyword (e.g., "flowchart", "sequenceDiagram", "classDiagram", "mindmap", etc.).
Use the most appropriate Mermaid diagram type for the request.
Supported types: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline, gitGraph, quadrantChart, xychart-beta.`;

const LATEX_SYSTEM_PROMPT = `You are an expert in LaTeX mathematical notation.
When asked to produce a formula or equation, respond with ONLY the LaTeX code for the mathematical expression, without any surrounding text, dollar signs, or code blocks.
The output will be passed directly to KaTeX for rendering in display mode.
Examples:
- For the quadratic formula: x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
- For Euler's identity: e^{i\\pi} + 1 = 0
- For a matrix: \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}`;

const AI_ASSISTANT_SYSTEM_PROMPT = `You are an AI assistant integrated into Excalidraw, a collaborative whiteboard application.
You help users with:
- Explaining diagrams and visual content
- Generating Mermaid diagram syntax
- Writing LaTeX mathematical formulas
- Answering questions about their drawings
- Suggesting improvements to diagrams
- Providing relevant technical information

When generating diagrams, output only the Mermaid syntax.
When generating LaTeX, output only the LaTeX expression.
Be concise and helpful.`;

export type AlbertTaskType = "diagram" | "latex" | "assistant";

interface AlbertStreamOptions {
  messages: readonly LLMMessage[];
  taskType?: AlbertTaskType;
  customSystemPrompt?: string;
  onChunk?: (chunk: string) => void;
  onStreamCreated?: () => void;
  signal?: AbortSignal;
}

function getApiConfig() {
  return {
    apiBase:
      import.meta.env.VITE_APP_ALBERT_API_BASE ||
      "https://albert.api.etalab.gouv.fr/v1",
    apiKey: import.meta.env.VITE_APP_ALBERT_API_KEY || "",
    model:
      import.meta.env.VITE_APP_ALBERT_MODEL || "AgentPublic/llama3-instruct-8b",
  };
}

function getSystemPrompt(
  taskType: AlbertTaskType,
  customSystemPrompt?: string,
): string {
  if (customSystemPrompt) {
    return customSystemPrompt;
  }
  switch (taskType) {
    case "diagram":
      return DIAGRAM_SYSTEM_PROMPT;
    case "latex":
      return LATEX_SYSTEM_PROMPT;
    case "assistant":
    default:
      return AI_ASSISTANT_SYSTEM_PROMPT;
  }
}

export async function albertStreamFetch(
  options: AlbertStreamOptions,
): Promise<TTTDDialog.OnTextSubmitRetValue> {
  const {
    messages,
    taskType = "diagram",
    customSystemPrompt,
    onChunk,
    onStreamCreated,
    signal,
  } = options;

  const { apiBase, apiKey, model } = getApiConfig();

  try {
    const systemPrompt = getSystemPrompt(taskType, customSystemPrompt);
    const openAIMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model,
        messages: openAIMessages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.3,
      }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          error: new RequestError({
            message:
              "Clé API Albert invalide. Configurez VITE_APP_ALBERT_API_KEY.",
            status: 401,
          }),
        };
      }
      if (response.status === 429) {
        return {
          rateLimit: 0,
          rateLimitRemaining: 0,
          error: new RequestError({
            message: "Limite de requêtes atteinte. Réessayez dans un moment.",
            status: 429,
          }),
        };
      }
      const text = await response.text();
      return {
        error: new RequestError({
          message: text || "Erreur Albert API",
          status: response.status,
        }),
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        error: new RequestError({
          message: "Impossible de lire le flux de réponse",
          status: 500,
        }),
      };
    }

    onStreamCreated?.();

    let fullResponse = "";
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) {
            continue;
          }

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            break;
          }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              onChunk?.(delta);
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    } catch (streamError: any) {
      if (streamError.name === "AbortError") {
        return {
          error: new RequestError({ message: "Requête annulée", status: 499 }),
        };
      }
      return {
        error: new RequestError({
          message: streamError.message || "Erreur de streaming",
          status: 500,
        }),
      };
    } finally {
      reader.releaseLock();
    }

    if (!fullResponse) {
      return {
        error: new RequestError({
          message: "Aucune réponse générée",
          status: 500,
        }),
      };
    }

    return {
      generatedResponse: fullResponse,
      error: null,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        error: new RequestError({ message: "Requête annulée", status: 499 }),
      };
    }
    return {
      error: new RequestError({
        message: err.message || "Échec de la requête",
        status: 500,
      }),
    };
  }
}

/** Simple non-streaming Albert API call (for short responses) */
export async function albertFetch(options: {
  messages: readonly LLMMessage[];
  taskType?: AlbertTaskType;
  customSystemPrompt?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const {
    messages,
    taskType = "assistant",
    customSystemPrompt,
    signal,
  } = options;
  const { apiBase, apiKey, model } = getApiConfig();

  const systemPrompt = getSystemPrompt(taskType, customSystemPrompt);
  const openAIMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: openAIMessages,
      stream: false,
      max_tokens: 1024,
      temperature: 0.4,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Albert API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
