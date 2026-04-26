import { useCallback, useEffect, useRef, useState } from "react";

import { isMaybeMermaidDefinition } from "@excalidraw/excalidraw/mermaid";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { getTextFromElements } from "@excalidraw/excalidraw";

import { albertStreamFetch } from "@excalidraw/excalidraw/components/TTDDialog/utils/albertApi";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import "./AIAssistantPanel.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  isGenerating?: boolean;
  mermaidCode?: string;
  latexCode?: string;
}

type AIMode = "diagram" | "latex" | "assistant";

// ─── Quick action templates ───────────────────────────────────────────────────

const QUICK_ACTIONS: Array<{
  icon: string;
  label: string;
  prompt: string;
  mode: AIMode;
}> = [
  {
    icon: "🔄",
    label: "Flowchart simple",
    prompt:
      "Génère un flowchart Mermaid simple pour un processus de connexion utilisateur (login, validation, accès)",
    mode: "diagram",
  },
  {
    icon: "📊",
    label: "Séquence API",
    prompt:
      "Génère un diagramme de séquence Mermaid pour une API REST : client → serveur → base de données",
    mode: "diagram",
  },
  {
    icon: "🗺️",
    label: "Mindmap",
    prompt:
      "Génère un mindmap Mermaid sur les bonnes pratiques de développement logiciel",
    mode: "diagram",
  },
  {
    icon: "∑",
    label: "Intégrale",
    prompt: "Formule de l'intégrale de Gauss",
    mode: "latex",
  },
  {
    icon: "📐",
    label: "Théorème Pythagore",
    prompt: "Formule du théorème de Pythagore avec preuve",
    mode: "latex",
  },
  {
    icon: "💡",
    label: "Expliquer le canvas",
    prompt: "Peux-tu analyser et décrire ce que représente ce diagramme ?",
    mode: "assistant",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

let msgCounter = 0;
const newId = () => `msg_${++msgCounter}_${Date.now()}`;

function detectCodeType(content: string): { mermaid?: string; latex?: string } {
  const trimmed = content.trim();

  // Check for code blocks
  const mermaidBlock = trimmed.match(/```(?:mermaid)?\s*([\s\S]+?)```/);
  if (mermaidBlock) {
    const code = mermaidBlock[1].trim();
    if (isMaybeMermaidDefinition(code)) {
      return { mermaid: code };
    }
  }

  // Bare mermaid
  if (isMaybeMermaidDefinition(trimmed)) {
    return { mermaid: trimmed };
  }

  return {};
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

export const AIAssistantPanel = ({ excalidrawAPI }: Props) => {
  const { openSidebar } = useUIAppState();
  const isVisible =
    openSidebar?.name === "default" && openSidebar?.tab === "ai";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AIMode>("assistant");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasApiKey = !!import.meta.env.VITE_APP_ALBERT_API_KEY;

  // Auto-scroll to latest message
  useEffect(() => {
    if (isVisible) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isVisible]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const openLatexTab = useCallback(
    (latex: string) => {
      // Copy latex to clipboard as fallback
      try {
        navigator.clipboard.writeText(latex);
      } catch {
        /* ignore */
      }
      excalidrawAPI.setToast({
        message: "LaTeX copié dans le presse-papier !",
      });
    },
    [excalidrawAPI],
  );

  const insertMermaid = useCallback(
    async (mermaidCode: string) => {
      try {
        // Dynamically import the mermaid lib to avoid bundle bloat
        const { parseMermaidToExcalidraw } = await import(
          "@excalidraw/mermaid-to-excalidraw"
        );
        const { convertToExcalidrawElements } = await import(
          "@excalidraw/element"
        );

        const result = await parseMermaidToExcalidraw(mermaidCode);
        const elements = convertToExcalidrawElements(result.elements, {
          regenerateIds: true,
        });

        excalidrawAPI.updateScene({
          elements: [...excalidrawAPI.getSceneElements(), ...elements],
        });
        if (result.files) {
          excalidrawAPI.addFiles(Object.values(result.files));
        }
        excalidrawAPI.setToast({ message: "Diagramme inséré !" });
      } catch (err: any) {
        excalidrawAPI.setToast({
          message: `Erreur d'insertion: ${err.message || "inconnu"}`,
        });
      }
    },
    [excalidrawAPI],
  );

  const sendMessage = useCallback(
    async (userContent: string, overrideMode?: AIMode) => {
      const effectiveMode = overrideMode ?? mode;
      const trimmed = userContent.trim();
      if (!trimmed || isGenerating) {
        return;
      }

      // Inject canvas context for "assistant" mode
      let contextualContent = trimmed;
      if (effectiveMode === "assistant") {
        const elements = excalidrawAPI.getSceneElements();
        const textContent = getTextFromElements(elements as any);
        if (textContent) {
          contextualContent = `Contexte du canvas (textes des éléments): "${textContent.slice(
            0,
            400,
          )}"\n\nQuestion: ${trimmed}`;
        }
      }

      const userMsg: Message = { id: newId(), role: "user", content: trimmed };
      const assistantMsg: Message = {
        id: newId(),
        role: "assistant",
        content: "",
        isGenerating: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsGenerating(true);

      const abortCtrl = new AbortController();
      abortRef.current = abortCtrl;

      // Build conversation history (last 6 messages)
      const history = messages
        .slice(-6)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      let accumulated = "";

      try {
        const result = await albertStreamFetch({
          messages: [...history, { role: "user", content: contextualContent }],
          taskType: effectiveMode,
          onChunk: (chunk) => {
            accumulated += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
              ),
            );
          },
          onStreamCreated: () => {
            // Stream started
          },
          signal: abortCtrl.signal,
        });

        if (result.error) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    role: "error" as const,
                    content: result.error!.message,
                    isGenerating: false,
                  }
                : m,
            ),
          );
        } else {
          const finalContent = result.generatedResponse || accumulated;
          const codeDetection = detectCodeType(finalContent);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: finalContent,
                    isGenerating: false,
                    mermaidCode: codeDetection.mermaid,
                    latexCode: codeDetection.latex,
                  }
                : m,
            ),
          );
        }
      } catch {
        // Aborted or failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: accumulated || "Génération interrompue.",
                  isGenerating: false,
                }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [mode, isGenerating, messages, excalidrawAPI],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="ai-assistant">
      {/* Header */}
      <div className="ai-assistant__header">
        <div className="ai-assistant__title">
          ✦ Assistant IA
          <span className="ai-badge">Albert</span>
        </div>
        <div className="ai-assistant__subtitle">
          Générez des diagrammes, formules LaTeX ou obtenez de l'aide sur votre
          canvas.
        </div>
      </div>

      {/* Mode selector */}
      <div className="ai-assistant__config">
        <label htmlFor="ai-mode-select">Mode :</label>
        <select
          id="ai-mode-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as AIMode)}
        >
          <option value="assistant">💬 Assistant général</option>
          <option value="diagram">📊 Diagramme Mermaid</option>
          <option value="latex">∑ Formule LaTeX</option>
        </select>
        {messages.length > 0 && (
          <button
            type="button"
            className="ai-assistant__clear-btn"
            onClick={() => setMessages([])}
            title="Effacer la conversation"
          >
            Effacer
          </button>
        )}
      </div>

      {/* API key notice */}
      {!hasApiKey && (
        <div className="ai-assistant__api-notice">
          ⚠️ Configurez <code>VITE_APP_ALBERT_API_KEY</code> dans votre{" "}
          <code>.env.local</code> pour activer l'IA.{" "}
          <a
            href="https://albert.api.etalab.gouv.fr"
            target="_blank"
            rel="noreferrer"
          >
            Obtenir une clé API
          </a>
        </div>
      )}

      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="ai-assistant__quick-actions">
          <div className="ai-assistant__quick-actions-label">
            Actions rapides
          </div>
          <div className="ai-assistant__quick-actions-grid">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="ai-assistant__quick-btn"
                onClick={() => {
                  setMode(action.mode);
                  sendMessage(action.prompt, action.mode);
                }}
                disabled={isGenerating}
              >
                <span className="icon">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="ai-assistant__messages">
        {messages.length === 0 && (
          <div className="ai-assistant__welcome">
            <span className="icon">✦</span>
            Décrivez un diagramme, une formule ou posez une question sur votre
            canvas.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-assistant__msg ai-assistant__msg--${msg.role}`}
          >
            <div className="ai-assistant__msg-avatar">
              {msg.role === "user" ? "U" : "✦"}
            </div>
            <div>
              <div className="ai-assistant__msg-bubble">
                {msg.isGenerating && !msg.content ? (
                  <div className="ai-assistant__typing">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* Action buttons for generated content */}
              {!msg.isGenerating && (msg.mermaidCode || msg.latexCode) && (
                <div className="ai-assistant__msg-actions">
                  {msg.mermaidCode && (
                    <button
                      type="button"
                      className="ai-assistant__msg-action-btn"
                      onClick={() => insertMermaid(msg.mermaidCode!)}
                    >
                      ↗ Insérer le diagramme
                    </button>
                  )}
                  {msg.latexCode && (
                    <button
                      type="button"
                      className="ai-assistant__msg-action-btn"
                      onClick={() => openLatexTab(msg.latexCode!)}
                    >
                      ∑ Copier LaTeX
                    </button>
                  )}
                  <button
                    type="button"
                    className="ai-assistant__msg-action-btn"
                    onClick={() => {
                      const code =
                        msg.mermaidCode || msg.latexCode || msg.content;
                      navigator.clipboard.writeText(code).catch(() => {});
                      excalidrawAPI.setToast({ message: "Copié !" });
                    }}
                  >
                    📋 Copier
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-assistant__input-area">
        {mode === "assistant" && (
          <div className="ai-assistant__context-hint">
            🎨 Le contexte du canvas est automatiquement inclus
          </div>
        )}
        <div className="ai-assistant__input-row">
          <textarea
            ref={textareaRef}
            className="ai-assistant__textarea"
            placeholder={
              mode === "diagram"
                ? "Décrivez votre diagramme… (Entrée pour envoyer)"
                : mode === "latex"
                ? "Décrivez la formule… ex: intégrale de Riemann"
                : "Posez une question ou demandez de l'aide…"
            }
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={handleKeyDown}
            disabled={isGenerating && !abortRef.current}
            rows={1}
          />
          {isGenerating ? (
            <button
              type="button"
              className="ai-assistant__stop-btn"
              onClick={stopGeneration}
              title="Arrêter la génération"
            >
              ⬛
            </button>
          ) : (
            <button
              type="button"
              className="ai-assistant__send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              title="Envoyer (Entrée)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
