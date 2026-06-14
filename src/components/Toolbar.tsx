import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { getAssetInfo, createShapesForAssets, type Editor } from 'tldraw'
import {
  editorAtom,
  pageLayoutAtom,
  pdfDocAtom,
  pdfListAtom,
  activePdfIdAtom,
  PAGE_GAP,
  type PageLayoutEntry,
  type PdfEntry,
} from '../store'
import { saveSession, type SavedSession } from '../db'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

async function loadPdf(
  data: Uint8Array,
): Promise<{ doc: pdfjsLib.PDFDocumentProxy; layout: PageLayoutEntry[] }> {
  const doc = await pdfjsLib.getDocument({ data }).promise
  const layout: PageLayoutEntry[] = []
  let top = 0
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const viewport = page.getViewport({ scale: 1 })
    layout.push({ index: i, width: viewport.width, height: viewport.height, top })
    top += viewport.height + PAGE_GAP
  }
  return { doc, layout }
}

async function insertImage(editor: Editor, file: File): Promise<void> {
  const asset = await getAssetInfo(editor, file)
  if (!asset) return

  const vp = editor.getViewportPageBounds()
  await createShapesForAssets(editor, [asset], { x: vp.x + vp.w / 2, y: vp.y + vp.h / 2 })
}

async function switchToPdf(
  editor: Editor | null,
  entry: PdfEntry,
  setPdfDoc: (doc: pdfjsLib.PDFDocumentProxy | null) => void,
  setLayout: (layout: PageLayoutEntry[]) => void,
) {
  const { doc, layout } = await loadPdf(entry.data)
  setPdfDoc(doc)
  setLayout(layout)

  const shapeIds = editor?.getCurrentPageShapeIds()
  if (shapeIds && shapeIds.size > 0) {
    editor?.deleteShapes([...shapeIds])
  }

  editor?.setCamera({ x: 0, y: 0, z: 1 })
}

export function Toolbar() {
  const editor = useAtomValue(editorAtom)
  const setPdfDoc = useSetAtom(pdfDocAtom)
  const setLayout = useSetAtom(pageLayoutAtom)
  const [pdfList, setPdfList] = useAtom(pdfListAtom)
  const [activePdfId, setActivePdfId] = useAtom(activePdfIdAtom)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const pdfs: PdfEntry[] = [...pdfList]
    let lastPdfId = activePdfId

    for (const file of files) {
      if (file.type === 'application/pdf') {
        const data = new Uint8Array(await file.arrayBuffer())
        const id = crypto.randomUUID()
        pdfs.push({ id, name: file.name, data })
        lastPdfId = id
      } else if (file.type.startsWith('image/')) {
        if (editor) {
          await insertImage(editor, file)
        }
      }
    }

    if (lastPdfId && lastPdfId !== activePdfId) {
      const entry = pdfs.find((p) => p.id === lastPdfId)
      if (entry) {
        setPdfList(pdfs)
        setActivePdfId(lastPdfId)
        await switchToPdf(editor, entry, setPdfDoc, setLayout)
      }
    } else if (pdfs.length !== pdfList.length) {
      setPdfList(pdfs)
    }

    const session: SavedSession = { pdfs, activePdfId: lastPdfId }
    try {
      await saveSession(session)
    } catch (err) {
      console.error('[toolbar] failed to save session:', err)
    }

    e.target.value = ''
  }

  const handlePdfSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    const entry = pdfList.find((p) => p.id === id)
    if (!entry) return

    setActivePdfId(id)
    await switchToPdf(editor, entry, setPdfDoc, setLayout)

    const session: SavedSession = { pdfs: pdfList, activePdfId: id }
    try {
      await saveSession(session)
    } catch (err) {
      console.error('[toolbar] failed to save session:', err)
    }
  }

  return (
    <div className="toolbar">
      <label className="toolbar-button file-button">
        Open
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          multiple
          onChange={handleFile}
          hidden
        />
      </label>

      {pdfList.length > 0 && (
        <select
          className="toolbar-select"
          value={activePdfId ?? ''}
          onChange={handlePdfSwitch}
        >
          {pdfList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

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
