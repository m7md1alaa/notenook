import { StateNode, createShapeId, type TLEventHandlers } from "tldraw";
import type { MathShape } from "./MathShape";

/**
 * "Math" tool: click anywhere on the canvas to drop a new math shape
 * at that point, immediately enter edit mode, and hand control back
 * to the select tool.
 */
export class MathTool extends StateNode {
  static override id = "math";

  override onEnter = () => {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  };

  override onPointerDown: TLEventHandlers["onPointerDown"] = () => {
    const { x, y } = this.editor.inputs.currentPagePoint;
    const id = createShapeId();

    this.editor.createShape<MathShape>({
      id,
      type: "math",
      x,
      y,
      props: { w: 160, h: 48, latex: "" },
    });

    this.editor.select(id);
    this.editor.setEditingShape(id);
    this.editor.setCurrentTool("select");
  };
}
