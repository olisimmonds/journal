import { useState } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from './useAutosave'

function Harness({
  onSave,
}: {
  onSave: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const status = useAutosave(value, onSave, 600)
  return (
    <div>
      <input aria-label="value" value={value} onChange={(e) => setValue(e.target.value)} />
      <output aria-label="status">{status}</output>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutosave', () => {
  it('persists a value via the debounce once the user pauses', async () => {
    const onSave = vi.fn(async () => {})
    const { getByLabelText } = render(<Harness onSave={onSave} />)

    await act(async () => {
      fireEvent.change(getByLabelText('value'), { target: { value: 'hello' } })
    })

    expect(onSave).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(onSave).toHaveBeenCalledWith('hello')
  })

  it('flushes a pending edit on unmount so a navigation does not drop it', async () => {
    const onSave = vi.fn(async () => {})
    const { getByLabelText, unmount } = render(<Harness onSave={onSave} />)

    await act(async () => {
      fireEvent.change(getByLabelText('value'), { target: { value: 'health data' } })
    })

    // Leave the page before the 600ms debounce fires — React cancels the
    // timer on unmount; the hook must still write the pending value.
    act(() => unmount())
    await act(async () => {})

    expect(onSave).toHaveBeenCalledWith('health data')
  })

  it('does not write on unmount when nothing changed', async () => {
    const onSave = vi.fn(async () => {})
    const { unmount } = render(<Harness onSave={onSave} />)

    act(() => unmount())
    await act(async () => {})

    expect(onSave).not.toHaveBeenCalled()
  })
})