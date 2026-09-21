import { useEffect, useState } from 'react'
import { Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Button, IconButton, Tooltip } from '@/ui'
import type { Submission } from '@/mocks'

const WAVEFORM = [
  4, 9, 14, 7, 18, 22, 11, 16, 25, 19, 13, 8, 21, 27, 17, 12, 9, 15, 23, 20, 10, 6, 14, 18, 26, 21, 13, 7,
  11, 19, 24, 16, 9, 5, 12, 20,
]

export function VoiceNoteRecorder({
  value,
  onChange,
  onRecorded,
}: {
  value: Submission['voiceNote']
  onChange: (note: Submission['voiceNote']) => void
  onRecorded?: () => void
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!recording) return
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(t)
  }, [recording])

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-body-13 font-semibold text-text">
          <Mic size={14} /> Voice-note feedback
        </h3>
        <span className="text-body-12 text-text-muted">Simulated — nothing is recorded</span>
      </div>

      {recording ? (
        <div className="flex items-center gap-3">
          <IconButton
            icon={Square}
            label="Stop recording"
            variant="danger"
            onClick={() => {
              setRecording(false)
              onChange({ url: `/voice/${Date.now().toString(36)}.m4a`, durationSeconds: Math.max(3, elapsed) })
              setElapsed(0)
              onRecorded?.()
            }}
          />
          <Waveform active />
          <span className="shrink-0 text-body-13 tabular-nums text-danger-text">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        </div>
      ) : value ? (
        <div className="flex items-center gap-3">
          <IconButton
            icon={playing ? Pause : Play}
            label={playing ? 'Pause voice note' : 'Play voice note'}
            variant="secondary"
            onClick={() => setPlaying((p) => !p)}
          />
          <Waveform active={playing} />
          <span className="shrink-0 text-body-13 tabular-nums text-text-secondary">
            {String(Math.floor(value.durationSeconds / 60)).padStart(2, '0')}:
            {String(value.durationSeconds % 60).padStart(2, '0')}
          </span>
          <Tooltip content="Record again">
            <IconButton
              icon={RotateCcw}
              label="Re-record voice note"
              variant="ghost"
              onClick={() => {
                onChange(null)
                setPlaying(false)
              }}
            />
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button variant="secondary" leftIcon={<Mic size={14} />} onClick={() => setRecording(true)}>
            Record voice note
          </Button>
          <p className="text-body-12 text-text-secondary">
            Thirty seconds of spoken feedback is worth a paragraph, and tutors here already use it.
          </p>
        </div>
      )}
    </div>
  )
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 min-w-0 flex-1 items-center gap-0.5" aria-hidden>
      {WAVEFORM.map((height, i) => (
        <span
          key={i}
          className={cn('w-1 shrink-0 rounded-full', active ? 'bg-accent' : 'bg-border-interactive')}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  )
}
