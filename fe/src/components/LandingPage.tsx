import { Show } from 'solid-js'
import { uiStore } from '../stores/uiStore'

export const LandingPage = () => {
  return (
    <div class="h-screen w-screen flex items-center justify-center">
      <div class="max-w-xl w-full px-6">
        <header class="mb-8">
          <h1 class="text-2xl font-semibold mb-2">Paragliding Harness Drop Test Visualizer</h1>
          <p class="text-sm text-gray-600 mb-4">
            Visualize and analyze real-world drop test data from harness back protectors.
          </p>
          <p class="text-sm text-gray-600">
            <strong>100% Private:</strong> All processing happens locally in your browser.
          </p>
          <p class="text-xs text-gray-500 mt-2">
            <a
              href="https://github.com/hyperknot/droptest"
              target="_blank"
              class="text-blue-600 hover:underline"
              rel="noopener"
            >
              Open source
            </a>{' '}
            project by Zsolt Ero.
          </p>
        </header>

        <div
          class={`border p-12 text-center transition-colors bg-white ${
            uiStore.state.isDragging ? 'border-black border-2' : 'border-neutral-400'
          }`}
        >
          <p class="text-lg font-medium mb-2">Drop a CSV drop test file here</p>
          <p class="text-xs text-gray-500">
            Expected format: CSV with columns: time0, datetime, accel
          </p>
        </div>

        <Show when={uiStore.state.error}>
          <div class="mt-4 border border-black bg-red-50 px-4 py-3 text-sm text-red-900">
            {uiStore.state.error}
          </div>
        </Show>
      </div>
    </div>
  )
}
