import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  cameraAtom,
  pageLayoutAtom,
  pdfDocAtom,
  visiblePageRangeAtom,
  type PageLayoutEntry,
} from "../store";

/** Backing-resolution multiplier so pages stay crisp at normal zoom levels. */
const RENDER_SCALE = 2;

function PdfPage({
  pdfDoc,
  page,
}: {
  pdfDoc: PDFDocumentProxy;
  page: PageLayoutEntry;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<
      import("pdfjs-dist").PDFPageProxy["render"]
    > | null = null;

    pdfDoc.getPage(page.index + 1).then((pdfPage) => {
      if (cancelled || !canvasRef.current) return;

      const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      renderTask = pdfPage.render({ canvasContext: ctx, viewport, canvas });
      renderTask.promise.catch(() => {
        /* render was cancelled on cleanup, ignore */
      });
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, page.index]);

  return (
    <canvas
      ref={canvasRef}
      className="pdf-page"
      style={{
        position: "absolute",
        top: page.top,
        left: 0,
        width: page.width,
        height: page.height,
      }}
    />
  );
}

/** Lightweight stand-in for pages outside the virtualized render window. */
function PdfPagePlaceholder({ page }: { page: PageLayoutEntry }) {
  return (
    <div
      className="pdf-page pdf-page-placeholder"
      style={{
        position: "absolute",
        top: page.top,
        left: 0,
        width: page.width,
        height: page.height,
      }}
    />
  );
}

/**
 * Renders the PDF as a layer underneath the tldraw canvas. Both layers share
 * one coordinate system (1 unit = 1 PDF point) and are driven by the same
 * `cameraAtom`, so they stay aligned without any per-shape syncing.
 */
export function PdfLayer() {
  const pdfDoc = useAtomValue(pdfDocAtom);
  const layout = useAtomValue(pageLayoutAtom);
  const camera = useAtomValue(cameraAtom);
  const visible = useAtomValue(visiblePageRangeAtom);

  return (
    <div className="pdf-layer">
      <div
        className="pdf-world"
        style={{
          // Matches tldraw's camera transform convention exactly.
          transform: `scale(${camera.z}) translate(${camera.x}px, ${camera.y}px)`,
          transformOrigin: "0 0",
        }}
      >
        {pdfDoc &&
          layout.map((page) =>
            visible.has(page.index) ? (
              <PdfPage key={page.index} pdfDoc={pdfDoc} page={page} />
            ) : (
              <PdfPagePlaceholder key={page.index} page={page} />
            ),
          )}
      </div>
    </div>
  );
}
