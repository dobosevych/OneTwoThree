import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Meeting } from "@/types"

interface DeleteMeetingDialogProps {
  meeting: Meeting | null
  onCancel: () => void
  onConfirm: (meeting: Meeting) => void
}

export function DeleteMeetingDialog({ meeting, onCancel, onConfirm }: DeleteMeetingDialogProps) {
  return (
    <AlertDialog open={meeting !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete <em>{meeting?.title}</em>?
          </AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => meeting && onConfirm(meeting)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
