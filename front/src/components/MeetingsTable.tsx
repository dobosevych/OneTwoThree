import { ExternalLink, MapPin, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Meeting } from "@/types"

const VISIBLE_PARTICIPANTS = 3

function ParticipantBadges({ meeting }: { meeting: Meeting }) {
  if (meeting.participants.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const visible = meeting.participants.slice(0, VISIBLE_PARTICIPANTS)
  const hidden = meeting.participants.slice(VISIBLE_PARTICIPANTS)
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((p) => (
        <Badge key={p.id} variant="secondary" title={p.email}>
          {p.name}
        </Badge>
      ))}
      {hidden.length > 0 && (
        <Badge variant="outline" title={hidden.map((p) => p.name).join(", ")}>
          +{hidden.length}
        </Badge>
      )}
    </div>
  )
}

function CallLink({ href }: { href: string | null }) {
  if (!href) return <span className="text-muted-foreground">—</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
    >
      Join <ExternalLink className="size-3.5" />
    </a>
  )
}

function DeleteButton({ meeting, onDelete }: { meeting: Meeting; onDelete: (m: Meeting) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${meeting.title}`}
      onClick={() => onDelete(meeting)}
    >
      <Trash2 className="text-destructive" />
    </Button>
  )
}

interface MeetingsTableProps {
  meetings: Meeting[]
  onDelete: (meeting: Meeting) => void
}

export function MeetingsTable({ meetings, onDelete }: MeetingsTableProps) {
  return (
    <>
      <div className="hidden rounded-md border sm:block">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Call</TableHead>
              <TableHead>Place</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell className="max-w-xs">
                  <div className="font-medium">{meeting.title}</div>
                  {meeting.description && (
                    <div className="text-muted-foreground truncate text-sm">{meeting.description}</div>
                  )}
                </TableCell>
                <TableCell>
                  <ParticipantBadges meeting={meeting} />
                </TableCell>
                <TableCell>
                  <CallLink href={meeting.call_link} />
                </TableCell>
                <TableCell>{meeting.place ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <DeleteButton meeting={meeting} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:hidden">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="gap-3 py-4">
            <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
              <div className="min-w-0">
                <CardTitle>{meeting.title}</CardTitle>
                {meeting.description && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{meeting.description}</p>
                )}
              </div>
              <DeleteButton meeting={meeting} onDelete={onDelete} />
            </CardHeader>
            <CardContent className="space-y-2 px-4 text-sm">
              <ParticipantBadges meeting={meeting} />
              <div className="flex flex-wrap items-center gap-4">
                <CallLink href={meeting.call_link} />
                {meeting.place && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {meeting.place}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
