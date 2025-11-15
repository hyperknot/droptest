import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { DropTestData } from '../types'

interface FileInfoProps {
  data: DropTestData
}

export const FileInfoPanel: Component<FileInfoProps> = (props) => {
  return (
    <section class="bg-white rounded border border-gray-200 p-2 space-y-2 text-sm">
      <h2 class="font-semibold text-base">File information</h2>

      <div class="space-y-1.5 text-xs">
        <div class="flex justify-between gap-2">
          <span class="text-gray-600">Filename:</span>
          <span class="font-medium text-right break-all">{props.data.filename}</span>
        </div>

        <div class="flex justify-between gap-2">
          <span class="text-gray-600">Sample count:</span>
          <span class="font-medium">{props.data.samples.length.toLocaleString()}</span>
        </div>

        <Show when={props.data.metadata.date}>
          <div class="flex justify-between gap-2">
            <span class="text-gray-600">Date:</span>
            <span class="font-medium">{props.data.metadata.date}</span>
          </div>
        </Show>
      </div>
    </section>
  )
}