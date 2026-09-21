import { useState } from "react"
import { CalendarX2, Plus } from "lucide-react"
import { toast } from "sonner"

import { BackToTop } from "@/components/BackToTop"
import { DeleteMeetingDialog } from "@/components/DeleteMeetingDialog"
import { MeetingFormDialog } from "@/components/MeetingFormDialog"
import { MeetingsTable } from "@/components/MeetingsTable"
import { SiteFooter } from "@/components/SiteFooter"
import { SiteHeader } from "@/components/SiteHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeleteMeeting, useMeetings } from "@/hooks/useMeetings"
import type { Meeting } from "@/types"

export default function App() {
  const { data: meetings, isPending, isError, error, refetch } = useMeetings()
  const deleteMeeting = useDeleteMeeting()
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Meeting | null>(null)

  const openForm = () => setFormOpen(true)

  const confirmDelete = (meeting: Meeting) => {
    setPendingDelete(null)
    deleteMeeting.mutate(meeting.id, {
      onSuccess: () => toast.success("Meeting deleted"),
      onError: (err) => toast.error(`Could not delete meeting: ${err.message}`),
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader onNewMeeting={openForm} />

      <section
        aria-hidden
        className="from-brand-dark via-brand relative h-40 overflow-hidden bg-gradient-to-br to-[#a4302a] sm:h-56"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_10%_90%,rgba(0,0,0,0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.04)_0_2px,transparent_2px_14px)]" />
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-foreground text-2xl font-semibold sm:text-[28px]">
            Welcome to the meetings scheduler
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
            Keep track of meetings, their participants, call links and places.
          </p>
        </div>

        <section className="bg-card rounded-sm border p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-foreground text-lg font-semibold">
              Meetings
              {meetings && meetings.length > 0 && (
                <span className="text-muted-foreground ml-2 font-normal">({meetings.length})</span>
              )}
            </h2>
            <Button onClick={openForm} className="px-5">
              <Plus /> New meeting
            </Button>
          </div>

          {isPending ? (
            <div className="space-y-2" aria-label="Loading meetings">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div role="alert" className="border-destructive/50 text-destructive rounded-sm border p-4">
              <p className="font-medium">Could not load meetings</p>
              <p className="text-sm">{error.message}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed p-12 text-center">
              <CalendarX2 className="text-brand size-10" />
              <p className="text-muted-foreground">No meetings yet</p>
              <Button onClick={openForm} className="px-5">
                <Plus /> New meeting
              </Button>
            </div>
          ) : (
            <MeetingsTable meetings={meetings} onDelete={setPendingDelete} />
          )}
        </section>
      </main>

      <SiteFooter />
      <BackToTop />

      <MeetingFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <DeleteMeetingDialog
        meeting={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
