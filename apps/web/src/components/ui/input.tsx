import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Input types whose browser picker should open on a click anywhere in the field. */
const PICKER_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time'])

function Input({ className, type, onClick, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        type && PICKER_TYPES.has(type) && 'cursor-pointer',
        className,
      )}
      onClick={(e) => {
        onClick?.(e)
        // Chrome opens a date picker only from its small icon; open it from anywhere in the field.
        if (!e.defaultPrevented && type && PICKER_TYPES.has(type) && !props.readOnly) {
          try {
            e.currentTarget.showPicker?.()
          } catch {
            // Not allowed here (e.g. no user activation): the field still works by typing.
          }
        }
      }}
      {...props}
    />
  )
}

export { Input }
