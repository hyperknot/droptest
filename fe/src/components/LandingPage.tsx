import type { Component } from 'solid-js'
import { Show } from 'solid-js'

interface LandingPageProps {
  isDragging: boolean
  error: string
}

export const LandingPage: Component<LandingPageProps> = (props) => {
  return (
    <div class="max-w-4xl mx-auto py-16 px-6 space-y-8">
      <header class="space-y-4">
        <h1 class="text-4xl font-bold tracking-tight">
          Harness Drop Test Data Visualizer
        </h1>
        <p class="text-lg text-gray-600">
          Visualize and analyze real-world drop test data from harness back protectors.
        </p>
        <p class="text-gray-600">
          This is an{' '}
          <a
            href="https://github.com/hyperknot/droptest"
            target="_blank"
            class="text-blue-600 hover:underline font-medium"
          >
            open source
          </a>{' '}
          project by Zsolt Ero.
        </p>
      </header>

      <div
        class={`border-2 border-dashed rounded-lg p-16 text-center transition-colors ${
          props.isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
        }`}
      >
        <p class="text-xl font-medium mb-3">Drop a CSV drop test file here</p>
        <p class="text-sm text-gray-500">
          Expected format: CSV with columns: time0, datetime, accel
        </p>
      </div>

      <Show when={props.error}>
        <div class="text-red-600 bg-red-50 p-4 rounded border border-red-200">
          {props.error}
        </div>
      </Show>
    </div>
  )
}