import { createSignal } from 'solid-js'
import { parseDropTestFile } from '../lib/csv-parser'
import type { DropTestData } from '../types'

export function useFileUpload() {
  const [testData, setTestData] = createSignal<DropTestData | null>(null)
  const [error, setError] = createSignal<string>('')
  const [isDragging, setIsDragging] = createSignal(false)

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError('')

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) {
      setError('No file dropped')
      return
    }

    const file = files[0]
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please drop a .csv file')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseDropTestFile(text, file.name)
      setTestData(parsed)
      setError('')
    } catch (err) {
      setError(`Error parsing file: ${err}`)
      console.error(err)
      setTestData(null)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  return {
    testData,
    error,
    isDragging,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  }
}
