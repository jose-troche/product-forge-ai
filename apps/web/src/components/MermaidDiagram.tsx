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

async function svgToPng(svg: string): Promise<string> {
  const parsedDocument = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsedDocument.documentElement;
  if (root.localName === "parsererror") {
    throw new Error("The Mermaid SVG is invalid.");
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

  const canvas = window.document.createElement("canvas");
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, rasterWidth, rasterHeight);

  const { Canvg } = await import("canvg");
  const renderer = Canvg.fromString(context, new XMLSerializer().serializeToString(root), {
    DOMParser,
    ignoreAnimation: true,
    ignoreMouse: true,
  });
  await renderer.render({
    ignoreAnimation: true,
    ignoreMouse: true,
    ignoreClear: true,
    ignoreDimensions: true,
    scaleWidth: rasterWidth,
    scaleHeight: rasterHeight,
  });

  return canvas.toDataURL("image/png");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Diagram rendering timed out.")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
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
  onStatus,
}: {
  code: string;
  onStatus: (status: "preparing" | "ready" | "error") => void;
}) {
  const reactId = useId();
  const [png, setPng] = useState("");
  const [fallbackSvg, setFallbackSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let renderedSvg = "";
    const id = `mermaid-print-${reactId.replace(/:/g, "")}`;
    setPng("");
    setFallbackSvg("");
    setError("");
    onStatus("preparing");

    void withTimeout(
      renderMermaid(code, id, true).then((svg) => {
        renderedSvg = svg;
        return svgToPng(svg);
      }),
      10_000,
    )
      .then((rendered) => {
        if (active) {
          setPng(rendered);
          onStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          if (renderedSvg) {
            setFallbackSvg(renderedSvg);
            onStatus("ready");
          } else {
            setError("Architecture diagram could not be rendered.");
            onStatus("error");
          }
        }
      });

    return () => {
      active = false;
    };
  }, [code, onStatus, reactId]);

  if (error) return <p className="print-mermaid-error">{error}</p>;
  if (!png && !fallbackSvg) return <p className="print-mermaid-loading">Preparing architecture diagram…</p>;

  return (
    <figure className="print-mermaid-figure">
      {png ? (
        <img src={png} alt="System architecture diagram" />
      ) : (
        <div
          className="print-mermaid-fallback"
          role="img"
          aria-label="System architecture diagram"
          dangerouslySetInnerHTML={{ __html: fallbackSvg }}
        />
      )}
      <figcaption>Generated architecture overview</figcaption>
    </figure>
  );
}
