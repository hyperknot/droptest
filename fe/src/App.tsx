import { Show } from 'solid-js'
import { LandingPage } from './components/LandingPage'
import { MainLayout } from './components/MainLayout'
import { uiStore } from './stores/uiStore'

export const AppUI = () => {
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    uiStore.setIsDragging(false)
    if (e.dataTransfer?.files?.[0]) {
      uiStore.loadFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div
      class="h-screen w-screen bg-white text-gray-900 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        uiStore.setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        uiStore.setIsDragging(false)
      }}
    >
      <Show when={uiStore.state.filename} fallback={<LandingPage />}>
        <MainLayout />
      </Show>
    </div>
  )
}
