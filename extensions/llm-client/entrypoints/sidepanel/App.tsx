import ExtensionHeader from '@/components/ExtensionHeader'
import LlmClientView from '../../components/LlmClientView'

export default function App() {
  return (
    <div className="flex h-screen flex-col px-3 py-3">
      <ExtensionHeader />
      <LlmClientView className="min-h-0 flex-1" />
    </div>
  )
}
