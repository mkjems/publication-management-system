import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A styled native <select>: accessible and keyboard-friendly in dense tables. The browser's own
 * arrow is replaced by a chevron with room on its right (see `native-select` in styles.css).
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-9 appearance-none rounded-md border border-input bg-card py-0 pr-8 pl-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
