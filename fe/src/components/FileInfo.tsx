import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { DropTestData } from '../types'

interface FileInfoProps {
  data: DropTestData
}

export const FileInfoPanel: Component<FileInfoProps> = (props) => {
  return (
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 py-2 px-3 space-y-4">
      <h2 class="text-lg font-semibold">File information</h2>

      <div class="grid gap-3 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Filename:</span>
          <span class="font-semibold">{props.data.filename}</span>
        </div>

        <div class="flex justify-between">
          <span class="text-gray-600">Sample count:</span>
          <span class="font-semibold">{props.data.samples.length.toLocaleString()}</span>
        </div>

        <Show when={props.data.metadata.date}>
          <div class="flex justify-between">
            <span class="text-gray-600">Date:</span>
            <span class="font-semibold">{props.data.metadata.date}</span>
          </div>
        </Show>

        <Show when={props.data.metadata.info && props.data.metadata.info.length > 0}>
          <div class="py-2 border-t border-gray-200 mt-2">
            <div class="text-xs text-gray-600 mb-1">File info:</div>
            <For each={props.data.metadata.info}>
              {(line) => <div class="text-xs text-gray-700">{line}</div>}
            </For>
          </div>
        </Show>
      </div>
    </section>
  )
}
