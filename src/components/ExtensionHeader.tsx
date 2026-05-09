import { browser } from 'wxt/browser'
import { useTheme, type ThemePreference } from '@/lib/useTheme'
import { Sun, Moon, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'


interface ExtensionHeaderProps {
  /** Override the extension name (defaults to manifest name) */
  name?: string
  /** Developer / company name shown in the header */
  developer?: string
}

const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Palette size={14} /> },
]

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === 'light') return <Sun size={14} />
  if (theme === 'dark') return <Moon size={14} />
  return <Palette size={14} />
}

export default function ExtensionHeader(props: ExtensionHeaderProps) {
  const manifest = browser.runtime.getManifest()
  const name = props.name ?? manifest.name ?? 'Extension'
  const { theme, setTheme } = useTheme()

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center text-sm mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold tracking-tight text-sm text-foreground/90">{name}</span>
          <span className="text-muted-foreground/50 text-xs">
            by{' '}
            <a
              href="https://sleekaddons.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              sleekaddons.com
            </a>
          </span>
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon-sm">
                <ThemeIcon theme={theme} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {themeOptions.map(({ value, label, icon }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setTheme(value)}
                  className={theme === value ? 'bg-accent' : ''}
                >
                  <span className="mr-2">{icon}</span>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />
    </div>
  )
}
