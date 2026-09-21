import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"

import { ParticipantsMultiSelect } from "@/components/ParticipantsMultiSelect"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCreateMeeting } from "@/hooks/useMeetings"
import { ApiError } from "@/lib/api"

const meetingSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Max 200 characters"),
    description: z.string().max(5000, "Max 5000 characters"),
    call_link: z.union([
      z.literal(""),
      z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" }),
    ]),
    place: z.string().trim().max(255, "Max 255 characters"),
    participants: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  })
  .refine((values) => values.call_link !== "" || values.place !== "", {
    message: "Provide a call link, a place, or both",
    path: ["place"],
  })

type MeetingFormValues = z.infer<typeof meetingSchema>

const emptyValues: MeetingFormValues = {
  title: "",
  description: "",
  call_link: "",
  place: "",
  participants: [],
}

const API_FIELD_TO_FORM: Record<string, keyof MeetingFormValues> = {
  title: "title",
  description: "description",
  call_link: "call_link",
  place: "place",
  participant_ids: "participants",
}

interface MeetingFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeetingFormDialog({ open, onOpenChange }: MeetingFormDialogProps) {
  const createMeeting = useCreateMeeting()
  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: emptyValues,
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(emptyValues)
    onOpenChange(next)
  }

  const onSubmit = async (values: MeetingFormValues) => {
    try {
      await createMeeting.mutateAsync({
        title: values.title,
        description: values.description.trim() || null,
        call_link: values.call_link || null,
        place: values.place || null,
        participant_ids: values.participants.map((p) => p.id),
      })
      toast.success("Meeting created")
      handleOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.issues.length > 0) {
        for (const issue of error.issues) {
          const field = API_FIELD_TO_FORM[String(issue.loc[1])]
          form.setError(field ?? "root", { message: issue.msg })
        }
        return
      }
      toast.error(error instanceof Error ? error.message : "Could not create meeting")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
          <DialogDescription>
            Add a call link, a place, or both so people know where to go.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Sprint planning" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this meeting about?" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="participants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Participants</FormLabel>
                  <FormControl>
                    <ParticipantsMultiSelect value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="call_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call link</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://meet.google.com/…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="place"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place</FormLabel>
                    <FormControl>
                      <Input placeholder="Room 204" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMeeting.isPending}>
                {createMeeting.isPending ? "Creating…" : "Create meeting"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
