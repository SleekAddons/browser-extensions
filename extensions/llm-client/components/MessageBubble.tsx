import type { ChatMessage } from '../lib/types'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { codeBlockComponents } from './CodeBlock'
import { Bot, User, FileText, TriangleAlert, Image, File } from 'lucide-react'

const plugins = { code }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return String(tokens)
}

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
}

export default function MessageBubble(props: MessageBubbleProps) {
  const { message, isStreaming } = props
  const isUser = message.role === 'user'
  const isError = message.role === 'assistant' && message.content.startsWith('Error: ')

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>
      <div className={`flex min-w-0 max-w-[85%] flex-col gap-1.5`}>
        <div className={`overflow-hidden rounded-lg text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground px-3 py-2'
            : isError
              ? 'bg-destructive/10 text-destructive px-3 py-2'
              : 'text-foreground'
        }`}>
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <Streamdown
              plugins={plugins}
              isAnimating={isStreaming}
              caret={isStreaming ? 'block' : undefined}
              className="sd-bubble break-words"
              components={codeBlockComponents}
            >
              {message.content}
            </Streamdown>
          )}
        </div>
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-muted-foreground"
              >
                {file.type.startsWith('image/') ? (
                  <Image size={10} className="shrink-0" />
                ) : (
                  <File size={10} className="shrink-0" />
                )}
                <span className="max-w-[140px] truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 opacity-60">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        )}
        {isUser && message.pageContext && (
          <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-muted-foreground ${isUser ? 'self-end' : 'self-start'}`}>
            {message.pageContext.truncated ? (
              <TriangleAlert size={10} className="shrink-0 text-destructive" />
            ) : (
              <FileText size={10} className="shrink-0" />
            )}
            <span className="truncate max-w-[180px]" title={message.pageContext.title}>
              {message.pageContext.title || 'Page content'}
            </span>
            <span className="shrink-0 opacity-60">
              ~{formatTokenCount(message.pageContext.tokens)} tokens
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
