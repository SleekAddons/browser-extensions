import type { ChatCommand, ChatOptions } from '../lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings2, FileText, Zap } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface ChatOptionsDropdownProps {
  chatOptions: ChatOptions
  commands: ChatCommand[]
  pageContext: string | null
  pageContextLoading: boolean
  onTogglePageContext: (enabled: boolean) => void
  onToggleCommand: (commandId: string, enabled: boolean) => void
}

export default function ChatOptionsDropdown(props: ChatOptionsDropdownProps) {
  const {
    chatOptions,
    commands,
    pageContext,
    pageContextLoading,
    onTogglePageContext,
    onToggleCommand,
  } = props

  const activeCount =
    (chatOptions.pageContextEnabled ? 1 : 0) + chatOptions.activeCommandIds.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={activeCount > 0 ? 'default' : 'ghost'}
          size="icon-sm"
          title="Chat options"
          className="relative"
        >
          {pageContextLoading ? (
            <Spinner className="size-3" />
          ) : (
            <Settings2 size={12} />
          )}
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="">Options</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={chatOptions.pageContextEnabled}
          onCheckedChange={(checked) => onTogglePageContext(!!checked)}
          disabled={pageContextLoading}
          className="gap-2"
        >
          <FileText size={12} className="shrink-0 opacity-60" />
          <div className="flex flex-col">
            <span>Include page content</span>
            {chatOptions.pageContextEnabled && pageContext && (
              <span className="text-muted-foreground">
                {Math.round(pageContext.length / 1000)}k chars attached
              </span>
            )}
            {chatOptions.pageContextEnabled && !pageContext && !pageContextLoading && (
              <span className="text-muted-foreground">
                No text found on page
              </span>
            )}
          </div>
        </DropdownMenuCheckboxItem>

        {commands.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="">Commands</DropdownMenuLabel>
            {commands.map((cmd) => (
              <DropdownMenuCheckboxItem
                key={cmd.id}
                checked={chatOptions.activeCommandIds.includes(cmd.id)}
                onCheckedChange={(checked) => onToggleCommand(cmd.id, !!checked)}
                className="gap-2"
              >
                <Zap size={12} className="shrink-0 opacity-60" />
                {cmd.name}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
