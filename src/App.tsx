import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PdfLayer } from "./components/PdfLayer";
import { CanvasLayer } from "./components/CanvasLayer";
import { Toolbar } from "./components/Toolbar";
import {
  pdfDocAtom,
  pageLayoutAtom,
  viewportSizeAtom,
  pdfListAtom,
  activePdfIdAtom,
  PAGE_GAP,
  type PageLayoutEntry,
} from "./store";
import { loadSession } from "./db";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setViewportSize = useSetAtom(viewportSizeAtom);
  const setPdfDoc = useSetAtom(pdfDocAtom);
  const setLayout = useSetAtom(pageLayoutAtom);
  const setPdfList = useSetAtom(pdfListAtom);
  const setActivePdfId = useSetAtom(activePdfIdAtom);

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

  useEffect(() => {
    ;(async () => {
      try {
        const session = await loadSession()
        if (!session || session.pdfs.length === 0) return

        setPdfList(session.pdfs)
        setActivePdfId(session.activePdfId)

        const activeEntry = session.pdfs.find((p) => p.id === session.activePdfId)
        if (!activeEntry) return

        const doc = await pdfjsLib.getDocument({ data: activeEntry.data }).promise
        setPdfDoc(doc)

        const layout: PageLayoutEntry[] = []
        let top = 0
        for (let i = 0; i < doc.numPages; i++) {
          const page = await doc.getPage(i + 1)
          const viewport = page.getViewport({ scale: 1 })
          layout.push({ index: i, width: viewport.width, height: viewport.height, top })
          top += viewport.height + PAGE_GAP
        }
        setLayout(layout)
      } catch (err) {
        console.error('[app] failed to restore session:', err)
      }
    })()
  }, [setPdfDoc, setLayout, setPdfList, setActivePdfId])

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
