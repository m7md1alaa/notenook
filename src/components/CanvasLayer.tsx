import { useCallback } from "react";
import { useSetAtom } from "jotai";
import {
  Tldraw,
  createShapeId,
  type Editor,
  type TLClipboardPasteRawInfo,
  type TLComponents,
} from "tldraw";
import "tldraw/tldraw.css";
import { cameraAtom, editorAtom } from "../store";
import { MathShapeUtil, type MathShape } from "../shapes/MathShape";
import { MathTool } from "../shapes/MathTool";

const shapeUtils = [MathShapeUtil];
const tools = [MathTool];

// Hide tldraw's default chrome — our own Toolbar drives the editor instead.
const components: TLComponents = {
  Toolbar: null,
  MainMenu: null,
  PageMenu: null,
  ActionsMenu: null,
  HelpMenu: null,
  ZoomMenu: null,
  NavigationPanel: null,
  StylePanel: null,
  DebugPanel: null,
  DebugMenu: null,
  ContextMenu: null,
  KeyboardShortcutsDialog: null,
};

function isLatex(text: string): boolean {
  // Delimiters — unambiguous math markers
  if (/^\$\$[\s\S]*\$\$$/.test(text)) return true;
  if (/^\\\([\s\S]*\\\)$/.test(text)) return true;
  if (/^\$[\s\S]*\$$/.test(text)) return true;

  // Contains \command{ or \command (e.g. \times, \frac, \sqrt, \alpha)
  if (/\\[a-zA-Z]{2,}/.test(text)) return true;

  // Superscript/subscript with braces
  if (/[\^_]\s*\{/.test(text)) return true;

  return false;
}

/**
 * The annotation layer. Sits transparently on top of the PdfLayer and shares
 * its coordinate system: the tldraw document only ever contains ink and
 * math shapes, never the PDF itself.
 */
export function CanvasLayer() {
  const setCamera = useSetAtom(cameraAtom);
  const setEditor = useSetAtom(editorAtom);

  const handleMount = useCallback(
    (editor: Editor) => {
      setEditor(editor);

      let prevCam = editor.getCamera();
      let rafId: number | null = null;

      const syncCamera = () => {
        rafId = null;
        const c = editor.getCamera();
        if (c.x === prevCam.x && c.y === prevCam.y && c.z === prevCam.z) return;
        prevCam = c;
        setCamera({ x: c.x, y: c.y, z: c.z });
      };

      syncCamera();

      const unsubscribe = editor.store.listen(
        () => {
          if (rafId === null) {
            rafId = requestAnimationFrame(syncCamera);
          }
        },
        { scope: "session" },
      );

      return () => {
        unsubscribe();
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    },
    [setCamera, setEditor],
  );

  const handlePasteRaw = useCallback((info: TLClipboardPasteRawInfo) => {
    if (info.source !== "native-event") return;

    const text = info.clipboardData?.getData("text/plain");
    if (!text) return;

    if (isLatex(text)) {
      info.event.preventDefault();

      const editor = info.editor;
      const point = info.point ?? editor.inputs.currentPagePoint;
      const id = createShapeId();

      editor.createShape<MathShape>({
        id,
        type: "math",
        x: point.x,
        y: point.y,
        props: { w: 160, h: 48, latex: text },
      });

      editor.select(id);
      editor.setEditingShape(id);

      return false;
    }
  }, []);

  return (
    <div className="canvas-layer">
      <Tldraw
        persistenceKey="notenook"
        shapeUtils={shapeUtils}
        tools={tools}
        components={components}
        onMount={handleMount}
        options={{ onClipboardPasteRaw: handlePasteRaw }}
      />
    </div>
  );
}
