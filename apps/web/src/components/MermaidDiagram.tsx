import { useEffect, useId, useState } from "react";

export function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const id = `mermaid-${reactId.replace(/:/g, "")}`;

    void import("mermaid")
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
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
        return mermaid.render(id, code);
      })
      .then(({ svg: rendered }) => {
        if (active) {
          setSvg(rendered);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Diagram preview is unavailable. The Mermaid source is included in exports.");
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
