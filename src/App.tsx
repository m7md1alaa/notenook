import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import { PdfLayer } from "./components/PdfLayer";
import { CanvasLayer } from "./components/CanvasLayer";
import { Toolbar } from "./components/Toolbar";
import { viewportSizeAtom } from "./store";
import "./styles.css";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setViewportSize = useSetAtom(viewportSizeAtom);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setViewportSize]);

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace" ref={containerRef}>
        <PdfLayer />
        <CanvasLayer />
      </div>
    </div>
  );
}
