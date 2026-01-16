/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/* eslint-disable @typescript-eslint/no-floating-promises */

export async function svgToDataURL(svg: SVGElement): Promise<string> {
  return Promise.resolve()
    .then(() => new XMLSerializer().serializeToString(svg))
    .then(encodeURIComponent)
    .then(html => `data:image/svg+xml;charset=utf-8,${html}`)
}

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      img.decode().then(() => {
        requestAnimationFrame(() => resolve(img))
      })
    }
    img.onerror = reject
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
  })
}

export interface ToCanvasOptions {
  /**
   * Width in pixels to be applied to node before rendering.
   */
  width?: number
  /**
   * Height in pixels to be applied to node before rendering.
   */
  height?: number
  /**
   * The pixel ratio of captured image. Default is the actual pixel ratio of
   * the device. Set 1 to use as initial-scale 1 for the image
   */
  pixelRatio?: number
  /**
   * Width in pixels to be applied to canvas on export.
   */
  canvasWidth?: number
  /**
   * Height in pixels to be applied to canvas on export.
   */
  canvasHeight?: number
  /**
   * A boolean to turn off auto scaling for truly massive images..
   */
  skipAutoScale?: boolean
  /**
   * A string value for the background color, any valid CSS color value.
   */
  backgroundColor?: string
}

export interface GetSvgSizeOptions {
  /**
   * Fallback width in pixels
   */
  width?: number
  /**
   * Fallback height in pixels
   */
  height?: number
}

export const getSvgSize = (
  svg: SVGElement,
  options: GetSvgSizeOptions = {},
): { width: number; height: number } => {
  const fromAttr = (input: string | null): number => {
    if (!input) {
      return 0
    }

    const result = parseInt(input, 10)

    return Number.isNaN(result) ? 0 : result
  }

  const width =
    svg.clientWidth ||
    fromAttr(svg.getAttribute('width')) ||
    (options.width ?? 0)

  const height =
    svg.clientHeight ||
    fromAttr(svg.getAttribute('height')) ||
    (options.height ?? 0)

  return { width, height }
}

// @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#maximum_canvas_size
const canvasDimensionLimit = 16384

export function checkCanvasDimensions(canvas: HTMLCanvasElement): void {
  if (
    canvas.width > canvasDimensionLimit ||
    canvas.height > canvasDimensionLimit
  ) {
    if (
      canvas.width > canvasDimensionLimit &&
      canvas.height > canvasDimensionLimit
    ) {
      if (canvas.width > canvas.height) {
        canvas.height *= canvasDimensionLimit / canvas.width
        canvas.width = canvasDimensionLimit
      } else {
        canvas.width *= canvasDimensionLimit / canvas.height
        canvas.height = canvasDimensionLimit
      }
    } else if (canvas.width > canvasDimensionLimit) {
      canvas.height *= canvasDimensionLimit / canvas.width
      canvas.width = canvasDimensionLimit
    } else {
      canvas.width *= canvasDimensionLimit / canvas.height
      canvas.height = canvasDimensionLimit
    }
  }
}

async function toCanvas(
  svg: SVGElement,
  options: ToCanvasOptions = {},
): Promise<HTMLCanvasElement> {
  const { width: fallbackWidth, height: fallbackHeight } = getSvgSize(svg)
  const width = options.width ?? fallbackWidth
  const height = options.height ?? fallbackHeight

  const img = await createImage(await svgToDataURL(svg))

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  const ratio = options.pixelRatio ?? window.devicePixelRatio
  const canvasWidth = options.canvasWidth ?? width
  const canvasHeight = options.canvasHeight ?? height

  canvas.width = canvasWidth * ratio
  canvas.height = canvasHeight * ratio

  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas)
  }
  canvas.style.width = `${canvasWidth}`
  canvas.style.height = `${canvasHeight}`

  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas
}

export interface CanvasToBLobOptions {
  /**
   * A string indicating the image format. The default type is image/png; that type is also used if the given type isn't supported.
   */
  type?: string
  /**
   * A number between `0` and `1` indicating image quality (e.g. 0.92 => 92%)
   * of the JPEG image.
   */
  quality?: number
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  options: CanvasToBLobOptions = {},
): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(resolve, options.type ?? 'image/png', options.quality ?? 1)
  })
}

export type ToBlobOptions = ToCanvasOptions & CanvasToBLobOptions

export async function toBlob(
  node: SVGElement,
  options: ToBlobOptions = {},
): Promise<Blob | null> {
  const canvas = await toCanvas(node, options)
  const blob = await canvasToBlob(canvas, options)
  return blob
}
