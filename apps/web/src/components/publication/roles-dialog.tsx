import { ROLE_IDS, ROLE_LABELS, assignRole, type Publication, type RoleId } from '@pms/domain'
import { Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCommand } from '@/hooks/use-command'
import { da } from '@/i18n/da'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'

/** Who holds which role on this book (used by Mine opgaver). Each toggle is one change. */
export function RolesDialog({
  publication: pub,
  onClose,
}: {
  publication: Publication
  onClose: () => void
}) {
  const run = useCommand(pub.id)
  const people = useWorkspace((s) => s.people)
  const addPerson = useWorkspace((s) => s.addPerson)
  const [name, setName] = useState('')
  const roles = useMemo(
    () =>
      ROLE_IDS.filter(
        (r) => r === 'project-lead' || pub.activities.some((a) => a.responsible.roles.includes(r)),
      ),
    [pub],
  )
  const holders = (r: RoleId) =>
    r === 'project-lead' && pub.projectLeadId && !pub.roleAssignments[r]
      ? [pub.projectLeadId]
      : (pub.roleAssignments[r] ?? [])

  function toggle(r: RoleId, personId: string) {
    const current = holders(r)
    const next = current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId]
    run((p, c) => assignRole(p, r, next, c))
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) addPerson(name)
    setName('')
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{da.roles.title}</DialogTitle>
          <DialogDescription>{da.roles.description}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[55svh] gap-px overflow-y-auto rounded-lg border bg-border">
          {roles.map((r) => (
            <div key={r} className="flex flex-wrap items-center gap-2 bg-card px-3 py-2">
              <span className="w-40 shrink-0 text-sm font-medium">{ROLE_LABELS[r]}</span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {people.length === 0 && (
                  <span className="text-xs text-muted-foreground">{da.roles.nobody}</span>
                )}
                {people.map((p) => {
                  const on = holders(r).includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(r, p.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={da.roles.addPersonPlaceholder}
            aria-label={da.roles.addPerson}
            className="max-w-60"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
            <Plus />
            {da.roles.addPerson}
          </Button>
        </form>
        <DialogFooter>
          <Button onClick={onClose}>{da.roles.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
