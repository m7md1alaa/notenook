import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  resizeBox,
  type Geometry2d,
  type RecordProps,
  type TLBaseShape,
  type TLResizeInfo,
} from "tldraw";
import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export interface MathShapeProps {
  w: number;
  h: number;
  latex: string;
}

export type MathShape = TLBaseShape<"math", MathShapeProps>;

// Registers 'math' as a recognized shape type in tldraw's global TLShape
// union, so editor.createShape/updateShape generics accept MathShape.
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    math: MathShapeProps;
  }
}

const MIN_WIDTH = 40;
const MIN_HEIGHT = 32;
const PADDING = 12;

/**
 * Renders raw LaTeX as clean math notation via KaTeX. Double-click to edit
 * the raw source; the shape auto-sizes to fit the rendered output.
 */
export class MathShapeUtil extends ShapeUtil<MathShape> {
  static override type = "math" as const;

  static override props: RecordProps<MathShape> = {
    w: T.number,
    h: T.number,
    latex: T.string,
  };

  override getDefaultProps(): MathShape["props"] {
    return { w: 160, h: 48, latex: "x^2 + y^2 = r^2" };
  }

  override canEdit() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  override getGeometry(shape: MathShape): Geometry2d {
    return new Rectangle2d({
      width: Math.max(shape.props.w, MIN_WIDTH),
      height: Math.max(shape.props.h, MIN_HEIGHT),
      isFilled: true,
    });
  }

  override onResize(shape: MathShape, info: TLResizeInfo<MathShape>) {
    return resizeBox(shape, info);
  }

  component(shape: MathShape) {
    return <MathShapeComponent shape={shape} util={this} />;
  }

  override getIndicatorPath(shape: MathShape): Path2D {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

/**
 * Function component for the math shape's content. Pulled out of
 * `MathShapeUtil.component` so that hooks (useState/useEffect/useRef) are
 * valid per the rules of hooks — `component()` itself is a class method,
 * not a component, even though it returns JSX.
 */
function MathShapeComponent({
  shape,
  util,
}: {
  shape: MathShape;
  util: MathShapeUtil;
}) {
  const editor = util.editor;
  const isEditing = editor.getEditingShapeId() === shape.id;
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-size the shape to fit the rendered KaTeX output.
  useEffect(() => {
    if (isEditing) return;
    const el = contentRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const zoom = editor.getZoomLevel();
    const newW = Math.max(rect.width / zoom + PADDING * 2, MIN_WIDTH);
    const newH = Math.max(rect.height / zoom + PADDING * 2, MIN_HEIGHT);

    if (
      Math.abs(newW - shape.props.w) > 1 ||
      Math.abs(newH - shape.props.h) > 1
    ) {
      editor.updateShape<MathShape>({
        id: shape.id,
        type: "math",
        props: { w: newW, h: newH },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape.props.latex, isEditing]);

  const html = renderLatex(shape.props.latex);

  const commit = () => {
    const latex = textareaRef.current?.value ?? shape.props.latex;
    editor.updateShape<MathShape>({
      id: shape.id,
      type: "math",
      props: { latex },
    });
    editor.setEditingShape(null);
  };

  return (
    <HTMLContainer
      id={shape.id}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: PADDING,
        pointerEvents: isEditing ? "all" : "none",
        border: isEditing ? "1px solid var(--color-selected, #4263eb)" : "none",
        borderRadius: 4,
        background: isEditing ? "var(--color-panel, white)" : "transparent",
      }}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          defaultValue={shape.props.latex}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") commit();
            // Shift+Enter for newline, Enter alone commits.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="x^2 + y^2 = r^2"
          style={{
            width: Math.max(shape.props.w - PADDING * 2, 120),
            minHeight: 24,
            resize: "none",
            fontFamily: "monospace",
            fontSize: 14,
            border: "none",
            outline: "none",
            background: "transparent",
          }}
        />
      ) : (
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ pointerEvents: "none" }}
        />
      )}
    </HTMLContainer>
  );
}

function renderLatex(latex: string): string {
  if (!latex.trim()) {
    return '<span style="opacity:0.4;font-family:monospace;font-size:14px;">double-click to edit</span>';
  }
  // Strip $$...$$, \(...\), and $...$ delimiters
  let source = latex.trim();
  const displayMatch = source.match(/^\$\$([\s\S]*?)\$\$$/);
  const inlineMatch = source.match(/^\\\(([\s\S]*?)\\\)$/);
  const singleDollarMatch = source.match(/^\$([\s\S]*?)\$$/);
  if (displayMatch) {
    source = displayMatch[1].trim();
  } else if (inlineMatch) {
    source = inlineMatch[1].trim();
  } else if (singleDollarMatch) {
    source = singleDollarMatch[1].trim();
  }
  try {
    return katex.renderToString(source, {
      throwOnError: false,
      displayMode: !!displayMatch,
    });
  } catch {
    return `<span style="color:#e03131;font-family:monospace;font-size:14px;">${escapeHtml(latex)}</span>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
