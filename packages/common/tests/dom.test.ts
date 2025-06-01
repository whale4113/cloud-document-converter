import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { waitForFunction } from '../src/dom'

describe('waitForFunction', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  test('should resolve immediately when function returns true', async () => {
    const mockFunc = vi.fn().mockReturnValue(true)

    await expect(waitForFunction(mockFunc)).resolves.toBeUndefined()
    expect(mockFunc).toHaveBeenCalledTimes(1)
  })

  test('should resolve after multiple retries', async () => {
    let callCount = 0
    const mockFunc = () => {
      callCount++
      return callCount >= 3
    }

    const promise = waitForFunction(mockFunc, { timeout: 1000 })
    await vi.advanceTimersByTimeAsync(300) // Advance past 3 retries (100ms each)

    await expect(promise).resolves.toBeUndefined()
    expect(callCount).toBe(3)
  })

  test('should throw timeout error when function never returns true', async () => {
    const mockFunc = vi.fn().mockReturnValue(false)
    const promise = waitForFunction(mockFunc, { timeout: 500 })

    vi.advanceTimersByTime(500)
    await expect(promise).rejects.toThrow('Timeout waiting for function: spy')
  })

  test('should handle async functions', async () => {
    const mockAsyncFunc = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    const promise = waitForFunction(mockAsyncFunc)
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).resolves.toBeUndefined()
    expect(mockAsyncFunc).toHaveBeenCalledTimes(2)
  })

  test('should clear timeout when resolved early', async () => {
    const mockFunc = vi.fn().mockReturnValue(true)
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    await waitForFunction(mockFunc)

    expect(setTimeoutSpy).toHaveBeenCalled()
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  test('should handle function throwing errors', async () => {
    const errorFunc = vi
      .fn()
      .mockRejectedValueOnce(new Error('mock error'))
      .mockResolvedValue(true)

    const promise = waitForFunction(errorFunc)
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).resolves.toBeUndefined()
    expect(errorFunc).toHaveBeenCalledTimes(2)
  })

  test('should use custom timeout duration', async () => {
    const mockFunc = vi.fn().mockReturnValue(false)
    const promise = waitForFunction(mockFunc, { timeout: 1000 })

    vi.advanceTimersByTime(1000)
    await expect(promise).rejects.toThrow()
  })

  test('should show function name in error message', async () => {
    function namedFunction() {
      return false
    }
    const promise = waitForFunction(namedFunction, { timeout: 100 })

    vi.advanceTimersByTime(100)
    await expect(promise).rejects.toThrow(
      'Timeout waiting for function: namedFunction',
    )
  })
})
