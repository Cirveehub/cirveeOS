import { useEffect, useState } from 'react'

import { Button, Field, Input, PageHeader, Select } from '@/ui'
import { peopleCollection, useCollection, type Gender } from '@/mocks'

import { Screen, studentToast, useStudent } from './common'
import { updateProfile } from './writes'

const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]

interface Draft {
  firstName: string
  lastName: string
  gender: string
  email: string
  phone: string
}

export default function Settings() {
  useCollection(peopleCollection)
  const { personId, person } = useStudent()

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (person) setDraft(draftFrom(person.firstName, person.lastName, person.gender, person.email, person.phone))
  }, [person?.id, person?.updatedAt])

  const dirty =
    person !== undefined &&
    JSON.stringify(draft) !==
      JSON.stringify(draftFrom(person.firstName, person.lastName, person.gender, person.email, person.phone))

  const emailValid = draft.email.trim() === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())
  const nameValid = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0

  function save() {
    if (!personId || !nameValid || !emailValid) return
    setSaving(true)
    updateProfile(personId, {
      firstName: draft.firstName,
      lastName: draft.lastName,
      gender: draft.gender ? (draft.gender as Gender) : undefined,
      email: draft.email,
      phone: draft.phone,
    })
    setSaving(false)
    studentToast.success('Your details have been updated.')
  }

  return (
    <Screen>
      <PageHeader title="Settings" description="Your personal details, as the academy holds them." />

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <p className="text-body-15 font-bold">Your profile</p>
          <p className="text-body-12 text-text-muted">
            These details are what the academy uses to reach you about your course.
          </p>
        </div>

        <div className="grid max-w-2xl gap-x-6 gap-y-5 px-6 py-6 sm:grid-cols-2">
          <Field label="First name" required error={draft.firstName.trim() ? undefined : 'Required'}>
            <Input
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              placeholder="First name"
            />
          </Field>

          <Field label="Last name" required error={draft.lastName.trim() ? undefined : 'Required'}>
            <Input
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              placeholder="Last name"
            />
          </Field>

          <Field label="Gender" optional className="sm:col-span-2">
            <Select
              value={draft.gender}
              onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
              placeholder="Not set"
              options={GENDERS}
            />
          </Field>

          <Field
            label="Email address"
            className="sm:col-span-2"
            error={emailValid ? undefined : 'That does not look like an email address.'}
          >
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="name@example.com"
            />
          </Field>

          <Field label="Phone number" hint="The number the academy calls and sends reminders to." className="sm:col-span-2">
            <Input
              type="tel"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="+234 800 000 0000"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() =>
              person &&
              setDraft(draftFrom(person.firstName, person.lastName, person.gender, person.email, person.phone))
            }
          >
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty || !nameValid || !emailValid}>
            Save changes
          </Button>
        </div>
      </section>
    </Screen>
  )
}

function emptyDraft(): Draft {
  return { firstName: '', lastName: '', gender: '', email: '', phone: '' }
}

function draftFrom(
  firstName: string,
  lastName: string,
  gender: Gender | undefined,
  email: string | null,
  phone: string | null,
): Draft {
  return {
    firstName,
    lastName,
    gender: gender ?? '',
    email: email ?? '',
    phone: phone ?? '',
  }
}
