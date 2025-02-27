export const imageDataToBlob = (
  imageData: ImageData,
  options: { onDispose?: () => void } = {},
): Promise<Blob | null> => {
  return new Promise(resolve => {
    const { onDispose } = options

    const width = imageData.width
    const height = imageData.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return Promise.resolve(null)
    }

    ctx.putImageData(imageData, 0, 0)
    onDispose?.()

    canvas.toBlob(resolve)
  })
}
