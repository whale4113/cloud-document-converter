export const svgToBlob = (svgElement: SVGElement): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    try {
      const scale = 2.0
      const format = 'image/png'
      const quality = 1.0

      // 1. 获取尺寸
      const width =
        svgElement.clientWidth ||
        parseInt(svgElement.getAttribute('width') ?? '0')
      const height =
        svgElement.clientHeight ||
        parseInt(svgElement.getAttribute('height') ?? '0')

      if (width === 0 || height === 0) {
        throw new Error('SVG size is 0, cannot export')
      }

      const serializer = new XMLSerializer()
      let svgString = serializer.serializeToString(svgElement)

      // 移除可能导致解析错误的控制字符
      // eslint-disable-next-line no-control-regex
      svgString = svgString.replace(/\x08/g, '')

      // 使用 encodeURIComponent 解决中文乱码问题
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

      const img = new Image()
      img.crossOrigin = 'Anonymous'

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = width * scale
          canvas.height = height * scale
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            throw new Error('Failed to get canvas context')
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          canvas.toBlob(
            blob => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Canvas toBlob failed'))
              }
            },
            format,
            quality,
          )
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      }

      img.onerror = () => {
        reject(new Error('SVG image loading failed'))
      }

      img.src = svgUrl
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}
// test
// test
