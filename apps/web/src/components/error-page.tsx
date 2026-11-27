import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { da } from '@/i18n/da'
import { errorText } from '@/lib/errors'

/**
 * Shown in place of a page that failed to render. The sidebar stays usable, and the data is
 * untouched: the error happened while drawing, not while saving.
 */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <div role="alert" className="mx-auto max-w-lg py-16 text-center">
      <TriangleAlert className="mx-auto size-8 text-status-late" />
      <h1 className="mt-3 text-lg font-semibold">{da.errorPage.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{da.errorPage.body}</p>
      <p className="mt-3 rounded-md bg-muted px-3 py-2 text-left font-mono text-xs break-words text-muted-foreground">
        {errorText(error)}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={reset}>{da.errorPage.retry}</Button>
        <Button variant="outline" asChild>
          <Link to="/" onClick={reset}>
            {da.errorPage.home}
          </Link>
        </Button>
      </div>
    </div>
  )
}
