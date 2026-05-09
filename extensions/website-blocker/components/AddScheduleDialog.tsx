import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BlockRule, Schedule } from '../lib/types'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AddScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (schedule: Omit<Schedule, 'id'>) => void
  /** Available domains from the block rules */
  availableDomains: BlockRule[]
}

export default function AddScheduleDialog({
  open,
  onOpenChange,
  onAdd,
  availableDomains,
}: AddScheduleDialogProps) {
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]) // Mon–Fri default
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [patterns, setPatterns] = useState<string[]>([])

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  const togglePattern = (pattern: string) => {
    setPatterns((prev) =>
      prev.includes(pattern)
        ? prev.filter((p) => p !== pattern)
        : [...prev, pattern],
    )
  }

  const handleSubmit = () => {
    if (!name.trim() || days.length === 0) return
    onAdd({
      name: name.trim(),
      days,
      startTime,
      endTime,
      patterns,
      enabled: true,
    })
    onOpenChange(false)
    setName('')
    setDays([1, 2, 3, 4, 5])
    setStartTime('09:00')
    setEndTime('17:00')
    setPatterns([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add Schedule</DialogTitle>
          <DialogDescription>
            Create a time window for when selected websites should be blocked.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule-name">Name</Label>
            <Input
              id="schedule-name"
              placeholder="e.g. Work hours"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Days */}
          <div className="space-y-1.5">
            <Label>Active days</Label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={days.includes(i) ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 w-9 px-0 text-xs"
                  onClick={() => toggleDay(i)}
                >
                  {label.charAt(0)}
                </Button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="schedule-start">Start</Label>
              <input
                id="schedule-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="schedule-end">End</Label>
              <input
                id="schedule-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Per-site scope */}
          {availableDomains.length > 0 && (
            <div className="space-y-1.5">
              <Label>Apply to sites <span className="text-muted-foreground font-normal">(none = all sites)</span></Label>
              <div className="flex flex-wrap gap-1">
                {availableDomains.map((rule) => (
                  <Badge
                    key={rule.id}
                    variant={patterns.includes(rule.pattern) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => togglePattern(rule.pattern)}
                  >
                    {rule.pattern}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!name.trim() || days.length === 0}>
              Add Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
