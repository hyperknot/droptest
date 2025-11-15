import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { DropTestData } from '../types'

interface FileInfoProps {
  data: DropTestData
}

export const FileInfoPanel: Component<FileInfoProps> = (props) => {
  return (
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 py-3 px-4 space-y-4">
      <h2 class="text-lg font-semibold">File information</h2>

      <div class="space-y-3 text-sm">
        <div class="flex justify-between gap-4">
          <span class="text-gray-600">Filename:</span>
          <span class="font-medium text-right break-all">{props.data.filename}</span>
        </div>

        <div class="flex justify-between gap-4">
          <span class="text-gray-600">Sample count:</span>
          <span class="font-medium">{props.data.samples.length.toLocaleString()}</span>
        </div>

        <Show when={props.data.metadata.date}>
          <div class="flex justify-between gap-4">
            <span class="text-gray-600">Date:</span>
            <span class="font-medium">{props.data.metadata.date}</span>
          </div>
        </Show>
      </div>
    </section>
  )
}