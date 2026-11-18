import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import LlmClientView from '../../components/LlmClientView'

export default function App() {
  return (
    <PopupContainer width={600} height={600} fixedHeight className="flex flex-col">
      <ExtensionHeader />
      <LlmClientView className="min-h-0 flex-1" />
    </PopupContainer>
  )
}
