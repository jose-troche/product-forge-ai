import { useEffect, useId, useState } from "react";

let renderQueue: Promise<void> = Promise.resolve();

function queueRender<T>(render: () => Promise<T>): Promise<T> {
  const result = renderQueue.then(render, render);
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function renderMermaid(code: string, id: string, print: boolean): Promise<string> {
  return queueRender(async () => {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      flowchart: {
        htmlLabels: !print,
      },
      themeVariables: print
        ? {
            background: "#ffffff",
            primaryColor: "#f4f8f6",
            primaryTextColor: "#17201c",
            primaryBorderColor: "#60744c",
            lineColor: "#53665b",
            secondaryColor: "#edf3ef",
            tertiaryColor: "#f8faf8",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          }
        : {
            background: "#0b1512",
            primaryColor: "#14231e",
            primaryTextColor: "#eef5ec",
            primaryBorderColor: "#405249",
            lineColor: "#6f8277",
            secondaryColor: "#182920",
            tertiaryColor: "#101b17",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          },
    });
    const { svg } = await mermaid.render(id, code);
    return svg;
  });
}

function svgToPng(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedDocument = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = parsedDocument.documentElement;
    if (root.localName === "parsererror") {
      reject(new Error("The Mermaid SVG is invalid."));
      return;
    }
    const viewBox = root
      .getAttribute("viewBox")
      ?.trim()
      .split(/\s+/)
      .map(Number);
    const viewBoxWidth = viewBox?.[2];
    const viewBoxHeight = viewBox?.[3];
    const width = viewBoxWidth !== undefined && Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 ? viewBoxWidth : 1_200;
    const height =
      viewBoxHeight !== undefined && Number.isFinite(viewBoxHeight) && viewBoxHeight > 0 ? viewBoxHeight : 800;
    const rasterWidth = Math.min(3_200, Math.max(1_800, Math.ceil(width * 2)));
    const rasterHeight = Math.ceil((height / width) * rasterWidth);

    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    root.setAttribute("width", String(width));
    root.setAttribute("height", String(height));

    const source = new XMLSerializer().serializeToString(root);
    const sourceUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();

    image.onload = () => {
      const canvas = window.document.createElement("canvas");
      canvas.width = rasterWidth;
      canvas.height = rasterHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(sourceUrl);
        reject(new Error("Canvas rendering is unavailable."));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, rasterWidth, rasterHeight);
      context.drawImage(image, 0, 0, rasterWidth, rasterHeight);
      URL.revokeObjectURL(sourceUrl);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error("The Mermaid SVG could not be rasterized."));
    };
    image.src = sourceUrl;
  });
}

export function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const id = `mermaid-${reactId.replace(/:/g, "")}`;

    void renderMermaid(code, id, false)
      .then((rendered) => {
        if (active) {
          setSvg(rendered);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Diagram preview is unavailable. Mermaid source remains available from the export menu.");
      });

    return () => {
      active = false;
    };
  }, [code, reactId]);

  if (error) return <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-4 text-xs text-amber-100">{error}</p>;
  return (
    <div
      className="mermaid-shell overflow-x-auto rounded-2xl border border-white/[.08] bg-black/15 p-4"
      aria-label="Architecture diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function MermaidRasterDiagram({
  code,
  onReady,
}: {
  code: string;
  onReady: (ready: boolean) => void;
}) {
  const reactId = useId();
  const [png, setPng] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const id = `mermaid-print-${reactId.replace(/:/g, "")}`;
    setPng("");
    setError("");
    onReady(false);

    void renderMermaid(code, id, true)
      .then(svgToPng)
      .then((rendered) => {
        if (active) {
          setPng(rendered);
          onReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setError("Architecture diagram could not be rendered.");
          onReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, [code, onReady, reactId]);

  if (error) return <p className="print-mermaid-error">{error}</p>;
  if (!png) return <p className="print-mermaid-loading">Preparing architecture diagram…</p>;

  return (
    <figure className="print-mermaid-figure">
      <img src={png} alt="System architecture diagram" />
      <figcaption>Generated architecture overview</figcaption>
    </figure>
  );
}
