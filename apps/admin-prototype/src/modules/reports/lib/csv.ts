export type CsvValue = string | number | null | undefined

function escape(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(columns: string[], rows: CsvValue[][]): string {
  return [columns.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
}

/** Kobo to a bare naira figure a spreadsheet can total. */
export function csvNaira(kobo: number): string {
  return (kobo / 100).toFixed(2)
}

export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([`﻿${contents}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
