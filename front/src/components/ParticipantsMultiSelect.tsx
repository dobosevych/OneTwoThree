import { useState } from "react"
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCreateParticipant, useParticipants } from "@/hooks/useParticipants"
import { parseNewParticipant } from "@/lib/participants"
import { cn } from "@/lib/utils"
import type { Participant } from "@/types"

interface ParticipantsMultiSelectProps {
  value: Participant[]
  onChange: (value: Participant[]) => void
  id?: string
}

export function ParticipantsMultiSelect({ value, onChange, id }: ParticipantsMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const newParticipant = parseNewParticipant(search)
  const { data: participants = [], isLoading } = useParticipants(newParticipant?.email ?? search)
  const createParticipant = useCreateParticipant()

  const selectedIds = new Set(value.map((p) => p.id))
  const canAdd =
    newParticipant !== null && !participants.some((p) => p.email === newParticipant.email)

  const toggle = (participant: Participant) => {
    onChange(
      selectedIds.has(participant.id)
        ? value.filter((p) => p.id !== participant.id)
        : [...value, participant],
    )
  }

  const addParticipant = async () => {
    if (!newParticipant) return
    try {
      const created = await createParticipant.mutateAsync(newParticipant)
      onChange([...value, created])
      setSearch("")
      toast.success(`Added ${created.name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add participant")
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn(value.length === 0 && "text-muted-foreground")}>
              {value.length === 0 ? "Select participants…" : `${value.length} selected`}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search, or type name + email to add"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {!isLoading && !canAdd && <CommandEmpty>No participants found.</CommandEmpty>}
              {participants.length > 0 && (
                <CommandGroup>
                  {participants.map((participant) => (
                    <CommandItem
                      key={participant.id}
                      value={participant.id}
                      onSelect={() => toggle(participant)}
                    >
                      <Check
                        className={cn(
                          selectedIds.has(participant.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span>{participant.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {participant.email}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canAdd && newParticipant && (
                <CommandGroup heading="New participant">
                  <CommandItem
                    value="__add__"
                    onSelect={addParticipant}
                    disabled={createParticipant.isPending}
                  >
                    <UserPlus />
                    Add participant “{newParticipant.name}” ({newParticipant.email})
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((participant) => (
            <Badge key={participant.id} variant="secondary" className="gap-1 pr-1">
              {participant.name}
              <button
                type="button"
                onClick={() => toggle(participant)}
                className="rounded-sm hover:bg-muted-foreground/20"
                aria-label={`Remove ${participant.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
