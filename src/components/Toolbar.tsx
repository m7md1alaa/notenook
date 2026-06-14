import { useAtomValue, useSetAtom } from 'jotai'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { editorAtom, pageLayoutAtom, pdfDocAtom, PAGE_GAP, type PageLayoutEntry } from '../store'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export function Toolbar() {
  const editor = useAtomValue(editorAtom)
  const setPdfDoc = useSetAtom(pdfDocAtom)
  const setLayout = useSetAtom(pageLayoutAtom)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const data = await file.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data }).promise
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

    editor?.setCamera({ x: 0, y: 0, z: 1 })
    e.target.value = ''
  }

  return (
    <div className="toolbar">
      <label className="toolbar-button file-button">
        Open PDF
        <input type="file" accept="application/pdf" onChange={handleFile} hidden />
      </label>

      <div className="toolbar-divider" />

      <button className="toolbar-button" onClick={() => editor?.setCurrentTool('select')}>
        Select
      </button>
      <button className="toolbar-button" onClick={() => editor?.setCurrentTool('draw')}>
        Pen
      </button>
      <button className="toolbar-button" onClick={() => editor?.setCurrentTool('eraser')}>
        Eraser
      </button>
      <button className="toolbar-button" onClick={() => editor?.setCurrentTool('math')}>
        Math
      </button>

      <div className="toolbar-divider" />

      <button className="toolbar-button" onClick={() => editor?.zoomOut()}>
        −
      </button>
      <button
        className="toolbar-button"
        onClick={() => editor?.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 200 } })}
      >
        Reset
      </button>
      <button className="toolbar-button" onClick={() => editor?.zoomIn()}>
        +
      </button>
    </div>
  )
}
