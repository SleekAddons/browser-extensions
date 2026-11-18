import { Plus, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import ContentCard from '@/components/ContentCard'
import type { BreakpointConfig } from '../lib/breakpoints'
import { t } from '../lib/i18n'

interface BreakpointListProps {
  breakpoints: BreakpointConfig[]
  isPreset?: boolean
  onUpdate: (index: number, patch: Partial<BreakpointConfig>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onReset: () => void
}

export default function BreakpointList(props: BreakpointListProps) {
  return (
    <ContentCard
      title={t('breakpointsTitle')}
      description={t('breakpointsDescription')}
      action={
        props.isPreset ? undefined : (
          <Button variant="ghost" onClick={props.onReset} className="text-muted-foreground" title={t('resetBreakpoints')}>
            <RotateCcw />
          </Button>
        )
      }
    >
      <div className="divide-y rounded-md border">
        {props.breakpoints.map((bp, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <Input
              type="color"
              value={bp.color}
              onChange={(e) => props.onUpdate(i, { color: e.target.value })}
              className="!h-7 !w-7 !min-w-7 !p-0.5 shrink-0 cursor-pointer rounded-md border-0"
              title={t('breakpointColor')}
            />
            <Input
              value={bp.name}
              onChange={(e) => props.onUpdate(i, { name: e.target.value })}
              className="h-7 flex-1 min-w-0"
              placeholder={t('breakpointNamePlaceholder')}
            />
            <InputGroup className="h-7 flex-[1.4] min-w-0">
              <InputGroupAddon align="inline-start">
                <InputGroupText>&ge;</InputGroupText>
              </InputGroupAddon>
              {/* No spin buttons: they take ~16px of this narrow field and cut off
                  4-digit widths like 1024. Arrow keys still step the value. */}
              <InputGroupInput
                type="number"
                min={0}
                value={bp.minWidth}
                onChange={(e) => props.onUpdate(i, { minWidth: Number(e.target.value) })}
                className="h-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>px</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => props.onRemove(i)}
              disabled={props.breakpoints.length <= 1}
              title={t('removeBreakpoint')}
              className="text-muted-foreground hover:text-destructive"
            >
              <X size={13} />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={props.onAdd}
      >
        <Plus size={14} /> {t('addBreakpoint')}
      </Button>
    </ContentCard>
  )
}
