import katex from "katex";
import "katex/dist/katex.min.css";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useDeferredValue,
} from "react";

import { IMAGE_MIME_TYPES } from "@excalidraw/common";
import { newImageElement } from "@excalidraw/element";

import { t } from "../../i18n";
import { useApp } from "../App";
import { ArrowRightIcon } from "../icons";

import { albertFetch } from "./utils/albertApi";
import { renderLatexToImage, validateLatex } from "./utils/latexToSVG";

import "./LaTeXToExcalidraw.scss";

import type { BinaryFileData, BinaryFiles } from "../../types";

const LATEX_EXAMPLES = [
  { label: "Intégrale", code: "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}" },
  { label: "Euler", code: "e^{i\\pi} + 1 = 0" },
  { label: "Quadratique", code: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { label: "Série", code: "\\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = e^x" },
  { label: "Matrice", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "Fourier", code: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)e^{-2\\pi i x\\xi}\\,dx" },
];

const LaTeXToExcalidraw = () => {
  const app = useApp();
  const theme = app.state.theme;

  const [input, setInput] = useState(LATEX_EXAMPLES[0].code);
  const [displayMode, setDisplayMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInserting, setIsInserting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const deferredInput = useDeferredValue(input);

  // Live preview rendering
  useEffect(() => {
    const node = previewRef.current;
    if (!node) {
      return;
    }
    if (!deferredInput.trim()) {
      node.innerHTML = "";
      setError(null);
      return;
    }
    try {
      katex.render(deferredInput, node, {
        displayMode,
        throwOnError: true,
        output: "html",
      });
      setError(null);
    } catch (err: any) {
      node.innerHTML = "";
      setError(err.message || "Erreur LaTeX");
    }
  }, [deferredInput, displayMode]);

  const onInsert = useCallback(async () => {
    const validationError = validateLatex(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!input.trim()) {
      return;
    }

    setIsInserting(true);
    try {
      const { dataURL, width, height, fileId } = await renderLatexToImage(
        input,
        displayMode,
        theme,
      );

      const fileData: BinaryFileData = {
        mimeType: IMAGE_MIME_TYPES.png,
        id: fileId,
        dataURL: dataURL as BinaryFileData["dataURL"],
        created: Date.now(),
      };

      const imageElement = newImageElement({
        type: "image",
        fileId,
        status: "saved",
        width,
        height,
        x: 0,
        y: 0,
      });

      const files: BinaryFiles = { [fileId]: fileData };

      app.addElementsFromPasteOrLibrary({
        elements: [imageElement],
        files,
        position: "center",
        fitToContent: true,
      });
      app.setOpenDialog(null);
    } catch (err: any) {
      setError(err.message || "Échec de l'insertion");
    } finally {
      setIsInserting(false);
    }
  }, [input, displayMode, theme, app]);

  const onGenerateLatex = useCallback(async () => {
    if (!aiPrompt.trim()) {
      return;
    }
    setIsGenerating(true);
    try {
      const result = await albertFetch({
        messages: [{ role: "user", content: aiPrompt }],
        taskType: "latex",
      });
      if (result.trim()) {
        // Strip any accidental $ signs or code block markers
        const cleaned = result
          .replace(/^\$+/, "")
          .replace(/\$+$/, "")
          .replace(/^```[\w]*\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        setInput(cleaned);
        setAiPrompt("");
        setShowAiPrompt(false);
      }
    } catch (err: any) {
      setError(err.message || "Erreur de génération IA");
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt]);

  return (
    <div className="latex-dialog">
      <p className="latex-dialog__description">
        Éditeur{" "}
        <a
          href="https://katex.org/docs/supported.html"
          target="_blank"
          rel="noreferrer"
        >
          LaTeX / KaTeX
        </a>{" "}
        — saisir une expression mathématique et l'insérer dans le canvas.
      </p>

      <div className="latex-dialog__options">
        <label className="latex-dialog__mode-toggle">
          <input
            type="checkbox"
            checked={displayMode}
            onChange={(e) => setDisplayMode(e.target.checked)}
          />
          Mode affichage (grande formule centrée)
        </label>
        <button
          className="latex-dialog__ai-btn"
          type="button"
          onClick={() => setShowAiPrompt((v) => !v)}
          title="Générer une formule avec l'IA"
        >
          ✦ Générer avec l'IA
        </button>
      </div>

      {showAiPrompt && (
        <div className="latex-dialog__ai-prompt">
          <div className="latex-dialog__ai-prompt-label">
            ✦ Décrire la formule à générer
          </div>
          <div className="latex-dialog__ai-prompt-input">
            <input
              type="text"
              placeholder="ex: formule de Bayes, transformée de Laplace..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onGenerateLatex();
                }
              }}
            />
            <button
              type="button"
              onClick={onGenerateLatex}
              disabled={isGenerating || !aiPrompt.trim()}
            >
              {isGenerating ? "Génération..." : "Générer"}
            </button>
          </div>
        </div>
      )}

      <div className="latex-dialog__panels">
        <div className="latex-dialog__panel">
          <div className="latex-dialog__panel-label">Code LaTeX</div>
          <div className="latex-dialog__editor">
            <textarea
              className={`latex-dialog__textarea${error ? " error" : ""}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrire une expression LaTeX…"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onInsert();
                }
              }}
            />
          </div>
          <div className="latex-dialog__examples">
            {LATEX_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="latex-dialog__example-btn"
                onClick={() => setInput(ex.code)}
                title={ex.code}
              >
                {ex.label}
              </button>
            ))}
          </div>
          {error && <div className="latex-dialog__error">{error}</div>}
        </div>

        <div className="latex-dialog__panel">
          <div className="latex-dialog__panel-label">Aperçu</div>
          <div className="latex-dialog__preview-container">
            {input.trim() ? (
              <div className="latex-dialog__preview-content" ref={previewRef} />
            ) : (
              <div className="latex-dialog__preview-empty" ref={previewRef}>
                L'aperçu apparaît ici…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="latex-dialog__actions">
        <button
          type="button"
          className="latex-dialog__insert-btn"
          onClick={onInsert}
          disabled={!input.trim() || !!error || isInserting}
        >
          {ArrowRightIcon}
          {isInserting ? "Insertion..." : t("mermaid.button")}
        </button>
      </div>
    </div>
  );
};

export default LaTeXToExcalidraw;
