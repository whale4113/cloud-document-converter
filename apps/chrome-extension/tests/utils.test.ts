import { describe, expect, it } from 'vitest'
import { UniqueFileName } from '../src/common/utils'

describe('UniqueFileName', () => {
  it('should generate unique filename', () => {
    const uniqueFilename = new UniqueFileName()
    const filename = uniqueFilename.generate('test.txt')
    expect(filename).toBe('test.txt')

    const filename2 = uniqueFilename.generate('test.txt')
    expect(filename2).toBe('test-1.txt')

    const filename3 = uniqueFilename.generate('test-1.txt')
    expect(filename3).toBe('test-1-1.txt')

    const filename4 = uniqueFilename.generate('test-2.txt')
    expect(filename4).toBe('test-2.txt')

    const filename5 = uniqueFilename.generate('test.txt')
    expect(filename5).toBe('test-3.txt')
  })
})
