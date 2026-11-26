import type { WaitingFor } from '@pms/domain'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { da } from '@/i18n/da'

export function WaitingDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: WaitingFor | null
  onSave: (w: WaitingFor) => void
}) {
  const ids = { text: useId(), date: useId() }
  const [text, setText] = useState(initial?.text ?? '')
  const [date, setDate] = useState(initial?.expectedDate ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSave({ text: text.trim(), expectedDate: date || null })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{da.waiting.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={ids.text}>{da.waiting.text}</Label>
            <Input
              id={ids.text}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={da.waiting.textPlaceholder}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={ids.date}>{da.waiting.expected}</Label>
            <Input
              id={ids.date}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {da.waiting.cancel}
            </Button>
            <Button type="submit">{da.waiting.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
