import katex from "katex";

import { randomId } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

// Cache the inlined font CSS to avoid repeated font fetches
let cachedFontCSS: string | null = null;
let fontCSSLoading: Promise<string> | null = null;

async function fetchAsDataURI(url: string): Promise<string> {
  try {
    const absUrl = url.startsWith("data:") ? url : new URL(url, location.href).href;
    const res = await fetch(absUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function buildInlinedKaTeXCSS(): Promise<string> {
  const fontFaceRules: string[] = [];
  const otherRules: string[] = [];
  const fontUrls = new Set<string>();

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        const text = rule.cssText;
        if (!text.includes("KaTeX") && !text.includes("katex")) {
          continue;
        }
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          fontFaceRules.push(text);
          const matches = text.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/g);
          for (const m of matches) {
            if (!m[1].startsWith("data:")) {
              fontUrls.add(m[1]);
            }
          }
        } else {
          otherRules.push(text);
        }
      }
    } catch {
      // Cross-origin stylesheets silently fail
    }
  }

  // Inline all font files as data URIs so the SVG can be used as an <img>
  const urlToDataURI = new Map<string, string>();
  await Promise.all(
    Array.from(fontUrls).map(async (url) => {
      const dataURI = await fetchAsDataURI(url);
      urlToDataURI.set(url, dataURI);
    }),
  );

  let allFontFace = fontFaceRules.join("\n");
  for (const [url, dataURI] of urlToDataURI) {
    // Escape special regex chars in the URL
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    allFontFace = allFontFace.replace(new RegExp(escaped, "g"), dataURI);
  }

  return allFontFace + "\n" + otherRules.join("\n");
}

function getKaTeXCSS(): Promise<string> {
  if (cachedFontCSS !== null) {
    return Promise.resolve(cachedFontCSS);
  }
  if (fontCSSLoading) {
    return fontCSSLoading;
  }
  fontCSSLoading = buildInlinedKaTeXCSS().then((css) => {
    cachedFontCSS = css;
    fontCSSLoading = null;
    return css;
  });
  return fontCSSLoading;
}

export interface LatexRenderResult {
  dataURL: string;
  width: number;
  height: number;
  fileId: FileId;
}

export async function renderLatexToImage(
  latex: string,
  displayMode: boolean,
  theme: "light" | "dark" = "light",
): Promise<LatexRenderResult> {
  // 1. Render KaTeX HTML
  const html = katex.renderToString(latex, {
    displayMode,
    throwOnError: true,
    output: "html",
  });

  // 2. Measure rendered dimensions using an off-screen container
  await document.fonts.ready;
  const measure = document.createElement("div");
  const padding = displayMode ? 16 : 8;
  measure.style.cssText = `position:fixed;left:-99999px;top:-99999px;padding:${padding}px;font-size:${displayMode ? 22 : 16}px;`;
  measure.innerHTML = html;
  document.body.appendChild(measure);
  await new Promise((r) => requestAnimationFrame(r));
  const { width, height } = measure.getBoundingClientRect();
  document.body.removeChild(measure);

  const svgWidth = Math.ceil(width) + padding * 2;
  const svgHeight = Math.ceil(height) + padding * 2;

  // 3. Build SVG with inlined fonts
  const fontCSS = await getKaTeXCSS();
  const bgColor = theme === "dark" ? "#1e1e2e" : "#ffffff";
  const fgColor = theme === "dark" ? "#cdd6f4" : "#1a1a1a";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
  <defs>
    <style>
      ${fontCSS}
      body,div { margin:0; padding:0; box-sizing:border-box; }
      .katex { color: ${fgColor}; font-size: ${displayMode ? 22 : 16}px; }
    </style>
  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}"/>
  <foreignObject x="${padding}" y="${padding}" width="${svgWidth - padding * 2}" height="${svgHeight - padding * 2}">
    <body xmlns="http://www.w3.org/1999/xhtml"
          style="margin:0;padding:0;background:transparent;color:${fgColor};font-size:${displayMode ? 22 : 16}px;">
      ${html}
    </body>
  </foreignObject>
</svg>`;

  // 4. Convert SVG → canvas → PNG data URL
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const dataURL = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = svgWidth * dpr;
      canvas.height = svgHeight * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, svgWidth, svgHeight);
      ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
      URL.revokeObjectURL(svgUrl);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Failed to render LaTeX to image"));
    };
    img.src = svgUrl;
  });

  return {
    dataURL,
    width: svgWidth,
    height: svgHeight,
    fileId: randomId() as unknown as FileId,
  };
}

export function validateLatex(latex: string): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true });
    return null;
  } catch (err: any) {
    return err.message || "Invalid LaTeX";
  }
}
