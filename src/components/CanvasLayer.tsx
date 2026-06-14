import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { Tldraw, type Editor, type TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { cameraAtom, editorAtom } from '../store'
import { MathShapeUtil } from '../shapes/MathShape'
import { MathTool } from '../shapes/MathTool'

const shapeUtils = [MathShapeUtil]
const tools = [MathTool]

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
}

/**
 * The annotation layer. Sits transparently on top of the PdfLayer and shares
 * its coordinate system: the tldraw document only ever contains ink and
 * math shapes, never the PDF itself.
 */
export function CanvasLayer() {
  const setCamera = useSetAtom(cameraAtom)
  const setEditor = useSetAtom(editorAtom)

  const handleMount = useCallback(
    (editor: Editor) => {
      setEditor(editor)

      const syncCamera = () => {
        const c = editor.getCamera()
        setCamera({ x: c.x, y: c.y, z: c.z })
      }

      syncCamera()

      // Camera position is stored on the page's "instance page state" record,
      // which is part of the session store — any change to it triggers this.
      const unsubscribe = editor.store.listen(
        () => {
          syncCamera()
        },
        { source: 'user', scope: 'session' }
      )

      return () => unsubscribe()
    },
    [setCamera, setEditor]
  )

  return (
    <div className="canvas-layer">
      <Tldraw
        shapeUtils={shapeUtils}
        tools={tools}
        components={components}
        onMount={handleMount}
      />
    </div>
  )
}
