import {
  DiagramToCodePlugin,
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
  TTDDialog,
  TTDStreamFetch,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { safelyParseJSON } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { albertStreamFetch } from "@excalidraw/excalidraw/components/TTDDialog/utils/albertApi";

import { TTDIndexedDBAdapter } from "../data/TTDStorage";

/** Returns true if the Albert API is configured for direct use */
function isAlbertConfigured(): boolean {
  return !!(import.meta.env.VITE_APP_ALBERT_API_KEY);
}

/** Returns true if the legacy Excalidraw AI backend is configured */
function isLegacyBackendConfigured(): boolean {
  const backend = import.meta.env.VITE_APP_AI_BACKEND;
  return !!(backend && backend !== "http://localhost:3016");
}

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const appState = excalidrawAPI.getAppState();

          const blob = await exportToBlob({
            elements: children,
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);
          const textFromFrameChildren = getTextFromElements(children);

          // Prefer legacy backend if configured; otherwise use Albert API
          if (isLegacyBackendConfigured()) {
            const response = await fetch(
              `${import.meta.env.VITE_APP_AI_BACKEND}/v1/ai/diagram-to-code/generate`,
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  texts: textFromFrameChildren,
                  image: dataURL,
                  theme: appState.theme,
                }),
              },
            );

            if (!response.ok) {
              const text = await response.text();
              const errorJSON = safelyParseJSON(text);

              if (!errorJSON) {
                throw new Error(text);
              }

              if (errorJSON.statusCode === 429) {
                return {
                  html: `<html>
                  <body style="margin: 0; text-align: center">
                  <div style="display:flex;align-items:center;justify-content:center;flex-direction:column;height:100vh;padding:0 60px">
                    <div style="color:red">Trop de requêtes aujourd'hui, réessayez demain !</div>
                  </div>
                  </body>
                  </html>`,
                };
              }
              throw new Error(errorJSON.message || text);
            }

            try {
              const { html } = await response.json();
              if (!html) {
                throw new Error("Generation failed (invalid response)");
              }
              return { html };
            } catch {
              throw new Error("Generation failed (invalid response)");
            }
          }

          // Albert API path: generate code description from text labels
          if (isAlbertConfigured()) {
            const textSummary = textFromFrameChildren || "un diagramme";
            const result = await albertStreamFetch({
              messages: [
                {
                  role: "user",
                  content: `Génère du code HTML pour visualiser ce diagramme décrit par les éléments suivants : ${textSummary}. Retourne UNIQUEMENT du code HTML valide prêt à afficher dans un iframe.`,
                },
              ],
              taskType: "assistant",
            });

            if (result.error) {
              throw new Error(result.error.message);
            }

            const content = result.generatedResponse || "";
            // Extract HTML if wrapped in code block
            const htmlMatch = content.match(/```html\s*([\s\S]+?)```/) ||
              content.match(/(<html[\s\S]+<\/html>)/i);
            const html = htmlMatch ? (htmlMatch[1] || htmlMatch[0]) : content;

            return { html: html || `<html><body style="padding:20px;font-family:sans-serif"><p>Génération IA: ${textSummary}</p></body></html>` };
          }

          // No backend configured
          return {
            html: `<html>
            <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:20px">
              <div>
                <p style="color:#888">Configurez <code>VITE_APP_ALBERT_API_KEY</code> ou <code>VITE_APP_AI_BACKEND</code> pour activer cette fonctionnalité.</p>
              </div>
            </body>
            </html>`,
          };
        }}
      />

      <TTDDialog
        onTextSubmit={async (props) => {
          const { onChunk, onStreamCreated, signal, messages } = props;

          // Use Albert API if configured, otherwise fall back to legacy backend
          if (isAlbertConfigured()) {
            return albertStreamFetch({
              messages,
              taskType: "diagram",
              onChunk,
              onStreamCreated,
              signal,
            });
          }

          // Legacy Excalidraw AI backend
          const result = await TTDStreamFetch({
            url: `${import.meta.env.VITE_APP_AI_BACKEND}/v1/ai/text-to-diagram/chat-streaming`,
            messages,
            onChunk,
            onStreamCreated,
            extractRateLimits: true,
            signal,
          });

          return result;
        }}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
