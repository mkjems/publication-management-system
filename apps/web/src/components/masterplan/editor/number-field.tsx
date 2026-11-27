import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * A whole-number input that commits on Enter or blur and resets on Escape. Invalid input is
 * reverted instead of committed.
 */
export function NumberField({
  value,
  onCommit,
  min,
  className,
  ...props
}: {
  value: number
  onCommit: (value: number) => void
  min?: number
  className?: string
  'aria-label': string
  disabled?: boolean
}) {
  const [text, setText] = useState(String(value))
  // Follow outside changes (undo, an edit that moved this activity).
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(String(value))
  }

  const commit = () => {
    const n = Number(text.replace('−', '-'))
    if (text.trim() === '' || !Number.isInteger(n) || (min !== undefined && n < min)) {
      setText(String(value))
      return
    }
    // Show the stored value again; if the edit went through, the new value follows.
    setText(String(value))
    if (n !== value) onCommit(n)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setText(String(value))
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const step = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 5 : 1)
          const n = value + step
          if (min === undefined || n >= min) onCommit(n)
        }
      }}
      className={cn(
        'h-8 w-16 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
