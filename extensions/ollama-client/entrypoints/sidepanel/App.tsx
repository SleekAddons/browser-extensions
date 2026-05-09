import ExtensionHeader from '@/components/ExtensionHeader'
import OllamaClientView from '../../components/OllamaClientView'

export default function App() {
  return (
    <div className="flex h-screen flex-col px-3 py-3">
      <ExtensionHeader />
      <OllamaClientView className="min-h-0 flex-1" />
    </div>
  )
}
