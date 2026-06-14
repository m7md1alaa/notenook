import { atom } from 'jotai'
import type { Editor } from 'tldraw'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Shared camera state, mirrored from tldraw's editor camera.
 * The PDF layer reads this and applies the *same* CSS transform
 * so both layers stay perfectly aligned under one source of truth.
 *
 * Convention (matches tldraw): the world-space point at the top-left
 * of the viewport is (-x, -y), and `z` is the zoom level.
 */
export interface CameraState {
  x: number
  y: number
  z: number
}

export const cameraAtom = atom<CameraState>({ x: 0, y: 0, z: 1 })

/** The currently loaded PDF document (pdf.js proxy), or null if none. */
export const pdfDocAtom = atom<PDFDocumentProxy | null>(null)

/** The tldraw editor instance, set once on mount so the toolbar can drive it. */
export const editorAtom = atom<Editor | null>(null)

/** Layout entry for a single PDF page, in world units (1 unit = 1 PDF point). */
export interface PageLayoutEntry {
  index: number
  width: number
  height: number
  top: number
}

export const pageLayoutAtom = atom<PageLayoutEntry[]>([])

/** Vertical gap between stacked pages, in world units. */
export const PAGE_GAP = 24

/** Size of the workspace viewport in screen pixels, kept in sync via ResizeObserver. */
export const viewportSizeAtom = atom<{ width: number; height: number }>({
  width: 0,
  height: 0,
})

/**
 * Derived: indices of pages that currently overlap the viewport (plus a buffer),
 * used to decide which pages pdf.js should actually render. This is the whole
 * virtualization strategy — only visible pages get a <canvas>.
 */
export const visiblePageRangeAtom = atom((get) => {
  const layout = get(pageLayoutAtom)
  const camera = get(cameraAtom)
  const viewport = get(viewportSizeAtom)

  if (layout.length === 0 || viewport.height === 0 || camera.z === 0) {
    return new Set<number>()
  }

  const top = -camera.y
  const bottom = top + viewport.height / camera.z
  const buffer = Math.max(bottom - top, 1) * 0.75 // generous buffer above/below

  const visible = new Set<number>()
  for (const page of layout) {
    if (page.top + page.height >= top - buffer && page.top <= bottom + buffer) {
      visible.add(page.index)
    }
  }
  return visible
})
