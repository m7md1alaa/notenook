import { memo, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
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

/** Match tldraw's toDomPrecision: round to 4 decimal places. */
function toDomPrecision(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

/**
 * Zoom-dependent sub-pixel anti-aliasing offset that tldraw applies to the
 * camera x/y so texture tiles don't bleed at the seams.
 */
function cameraOffset(z: number): number {
  if (z >= 1) {
    const t = Math.min(Math.max((z - 1) / (8 - 1), 0), 1);
    return 0.125 + t * (0.5 - 0.125);
  }
  const t = Math.min(Math.max((z - 0.1) / (1 - 0.1), 0), 1);
  return -2 + t * (0.125 - -2);
}

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
      renderTask.promise.catch(() => {});
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

const PdfPageMemo = memo(PdfPage);

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

const PdfPagePlaceholderMemo = memo(PdfPagePlaceholder);

/**
 * Thin wrapper that reads the camera atom and applies the transform so that
 * only this component re-renders when the user pans/zooms — the page canvases
 * below stay untouched.
 */
function CameraTransform({ children }: { children: React.ReactNode }) {
  const camera = useAtomValue(cameraAtom);

  const offset = cameraOffset(camera.z);
  const z = toDomPrecision(camera.z);
  const tx = toDomPrecision(camera.x + offset);
  const ty = toDomPrecision(camera.y + offset);

  return (
    <div
      className="pdf-world"
      style={{
        transform: `scale(${z}) translate(${tx}px,${ty}px)`,
        transformOrigin: "0 0",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Reads the PDF document, layout, and visible range — no camera dependency,
 * so camera movement never re-renders this component or its page canvases.
 */
function PdfPages() {
  const pdfDoc = useAtomValue(pdfDocAtom);
  const layout = useAtomValue(pageLayoutAtom);
  const visible = useAtomValue(visiblePageRangeAtom);

  if (!pdfDoc) return null;

  return layout.map((page) =>
    visible.has(page.index) ? (
      <PdfPageMemo key={page.index} pdfDoc={pdfDoc} page={page} />
    ) : (
      <PdfPagePlaceholderMemo key={page.index} page={page} />
    ),
  );
}

/**
 * Renders the PDF as a layer underneath the tldraw canvas. Both layers share
 * one coordinate system (1 unit = 1 PDF point) and are driven by the same
 * `cameraAtom`, so they stay aligned without any per-shape syncing.
 */
export function PdfLayer() {
  return (
    <div className="pdf-layer">
      <CameraTransform>
        <PdfPages />
      </CameraTransform>
    </div>
  );
}
