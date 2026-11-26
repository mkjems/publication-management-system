import type { ComponentType } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export function ComingSoon({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="font-medium">{title}</div>
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  )
}
