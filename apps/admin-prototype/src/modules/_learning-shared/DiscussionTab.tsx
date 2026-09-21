import { useState } from 'react'
import { Pin, Trash2 } from 'lucide-react'

import { formatRelative } from '@/lib/format'
import { Avatar, Badge, Button, EmptyState, IconButton, Textarea } from '@/ui'
import { peopleCollection, type CohortDiscussionPost } from '@/mocks'

export function DiscussionTab({
  posts,
  currentPersonId,
  onPost,
  onDelete,
  onPin,
}: {
  posts: CohortDiscussionPost[]
  currentPersonId: string | undefined
  onPost: (body: string) => void
  onDelete: (postId: string) => void
  onPin?: (postId: string, pinned: boolean) => void
}) {
  const [draft, setDraft] = useState('')

  const ordered = [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.postedAt.localeCompare(a.postedAt)
  })

  function submit() {
    if (!draft.trim()) return
    onPost(draft.trim())
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question or share something with the cohort."
        />
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={!draft.trim()} onClick={submit}>
            Post
          </Button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <EmptyState title="No posts yet" message="Be the first to say something to the cohort." bordered />
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((post) => {
            const person = peopleCollection.find(post.authorPersonId)
            const name = person ? `${person.firstName} ${person.lastName}` : 'Someone'
            const mine = post.authorPersonId === currentPersonId

            return (
              <li key={post.id} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
                <Avatar name={name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-13 font-semibold text-text">{name}</span>
                    <Badge tone={post.authorRole === 'tutor' ? 'accent' : 'neutral'} variant="subtle" size="sm">
                      {post.authorRole === 'tutor' ? 'Tutor' : 'Student'}
                    </Badge>
                    {post.pinned && (
                      <Badge tone="warning" variant="subtle" size="sm" icon={<Pin size={10} />}>
                        Pinned
                      </Badge>
                    )}
                    <span className="text-body-12 text-text-muted">{formatRelative(post.postedAt)}</span>

                    <div className="ml-auto flex items-center gap-1">
                      {onPin && mine && (
                        <IconButton
                          icon={Pin}
                          label={post.pinned ? 'Unpin post' : 'Pin post'}
                          variant="ghost"
                          size="sm"
                          onClick={() => onPin(post.id, !post.pinned)}
                        />
                      )}
                      {mine && (
                        <IconButton
                          icon={Trash2}
                          label="Delete post"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(post.id)}
                        />
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-body-14 text-text-secondary">{post.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
