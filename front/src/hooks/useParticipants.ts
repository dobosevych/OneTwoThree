import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function useParticipants(q = "") {
  return useQuery({
    queryKey: ["participants", q],
    queryFn: () => api.listParticipants(q),
    placeholderData: keepPreviousData,
  })
}

export function useCreateParticipant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createParticipant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants"] }),
  })
}
