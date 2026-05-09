import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import HreflangValidatorView from '../../components/HreflangValidatorView'

export default function App() {
  return (
    <PopupContainer width={380}>
      <ExtensionHeader />
      <HreflangValidatorView />
    </PopupContainer>
  )
}
