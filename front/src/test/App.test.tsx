import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import App from "@/App"
import { parseNewParticipant } from "@/components/ParticipantsMultiSelect"
import { mockFetch, renderWithQuery, sampleMeeting } from "@/test/utils"

describe("App", () => {
  it("lists meetings with participants as badges", async () => {
    mockFetch(() => ({ body: [sampleMeeting] }))
    renderWithQuery(<App />)

    const table = await screen.findByRole("table")
    expect(within(table).getByText("Sprint planning")).toBeInTheDocument()
    expect(within(table).getByText("Anna")).toHaveAttribute("data-slot", "badge")
    expect(within(table).getByRole("link", { name: /join/i })).toHaveAttribute(
      "href",
      sampleMeeting.call_link,
    )
  })

  it("shows the empty state", async () => {
    mockFetch(() => ({ body: [] }))
    renderWithQuery(<App />)
    expect(await screen.findByText("No meetings yet")).toBeInTheDocument()
  })

  it("asks for confirmation before deleting", async () => {
    const fetchMock = mockFetch((_url, init) =>
      init?.method === "DELETE" ? { status: 204 } : { body: [sampleMeeting] },
    )
    renderWithQuery(<App />)

    const table = await screen.findByRole("table")
    await userEvent.click(within(table).getByRole("button", { name: "Delete Sprint planning" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Delete Sprint planning?")
    expect(fetchMock).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }))

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/meetings/${sampleMeeting.id}`,
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})

describe("parseNewParticipant", () => {
  it("splits name and email", () => {
    expect(parseNewParticipant("Anna Kovalenko Anna@Example.com")).toEqual({
      name: "Anna Kovalenko",
      email: "anna@example.com",
    })
  })

  it("needs both a name and an email", () => {
    expect(parseNewParticipant("anna@example.com")).toBeNull()
    expect(parseNewParticipant("Anna")).toBeNull()
  })
})
