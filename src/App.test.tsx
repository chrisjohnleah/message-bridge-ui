import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("App", () => {
  it("opens without a commercial licence or account gate", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/");
    const { App } = await import("./App");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Maya Thompson" })).toBeVisible();
    expect(screen.queryByText(/licence key/i)).not.toBeInTheDocument();
  });

  it("renders the novice onboarding flow when setup is incomplete", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/?screen=onboarding");
    const { App } = await import("./App");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Tell us about your business" })).toBeVisible();
    expect(screen.getByLabelText("Business name")).toBeVisible();
  });

  it("lets a user edit customer memory from a real conversation", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/");
    const { App } = await import("./App");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Maya Thompson" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Maya is a repeat customer." } });
    fireEvent.change(screen.getByLabelText("What matters"), { target: { value: "Prefers oat\nNeeds 18 pads" } });
    fireEvent.change(screen.getByLabelText("Next step"), { target: { value: "Send the updated quote." } });
    fireEvent.click(screen.getByRole("button", { name: "Save context" }));

    await waitFor(() => expect(screen.getByText("Maya is a repeat customer.")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Customers" }));
    expect(await screen.findByText("Maya Thompson")).toBeVisible();
    expect(screen.getByText("Prefers oat • Needs 18 pads")).toBeVisible();
  });

  it("requires a new credential when the user changes provider", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/");
    const { App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "anthropic" } });

    expect(screen.getByLabelText("Replace API key")).toHaveAttribute("placeholder", "Paste API key");
    expect(screen.getByRole("button", { name: "Test and save" })).toBeDisabled();
  });

  it("shows account routing in the unified inbox", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/");
    const { App } = await import("./App");
    render(<App />);

    expect((await screen.findAllByText("via Valley Upholstery"))[0]).toBeVisible();
    expect(screen.getByLabelText("Filter by WhatsApp account")).toBeVisible();
    expect(screen.getAllByText("Workshop enquiries").length).toBeGreaterThan(0);
  });

  it("links another isolated account and exposes copyable MCP setup", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/?screen=connections");
    const { App } = await import("./App");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Messaging accounts" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Use Message Bridge with an MCP client" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Codex" }));
    expect(await screen.findByText("[mcp_servers.message_bridge]", { exact: false })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Link another account" }));
    fireEvent.change(screen.getByLabelText("Account name"), { target: { value: "Showroom phone" } });
    fireEvent.click(screen.getByRole("button", { name: "Create secure connection" }));

    expect(await screen.findByText("Waiting for scan")).toBeVisible();
    expect(screen.getByText("This account gets its own private session on this computer.")).toBeVisible();
  });

  it("shows candid open-source, privacy, and provider-risk disclosures", async () => {
    vi.resetModules();
    window.history.replaceState({}, "", "/?screen=about");
    const { App } = await import("./App");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Open source & privacy" })).toBeVisible();
    expect(screen.getByText("Unofficial compatibility software")).toBeVisible();
    expect(screen.getByText(/could lead to account restrictions/i)).toBeVisible();
    expect(screen.getByText(/AI is optional/i)).toBeVisible();
  });
});
