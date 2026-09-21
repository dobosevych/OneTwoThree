import type { ParticipantCreate } from "@/types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Anna Kovalenko anna@example.com" -> { name, email }; null when it isn't a name + email. */
export function parseNewParticipant(input: string): ParticipantCreate | null {
  const tokens = input.trim().replace(/[<>,]/g, " ").split(/\s+/).filter(Boolean)
  const emailIndex = tokens.findIndex((token) => EMAIL_RE.test(token))
  if (emailIndex === -1) return null
  const name = tokens.filter((_, i) => i !== emailIndex).join(" ")
  if (!name) return null
  return { name, email: tokens[emailIndex].toLowerCase() }
}
