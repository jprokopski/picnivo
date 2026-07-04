import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import { DeleteEvent } from "./delete-event";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../functions", () => ({
  deleteEventFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { deleteEventFn } from "../functions";
import { toast } from "sonner";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.mocked(deleteEventFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  navigate.mockClear();
});

function confirmDelete() {
  fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
  const dialog = screen.getByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete event" }));
}

describe("DeleteEvent", () => {
  it("renders the delete trigger button", () => {
    render(
      <Wrapper>
        <DeleteEvent token="tok1" title="Sunset Beach Picnic" />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: "Delete event" })).toBeDefined();
  });

  it("opens the confirm dialog naming the event before deleting", () => {
    render(
      <Wrapper>
        <DeleteEvent token="tok1" title="Sunset Beach Picnic" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));

    expect(screen.getByText('Delete "Sunset Beach Picnic"?')).toBeDefined();
    expect(deleteEventFn).not.toHaveBeenCalled();
  });

  it("calls deleteEventFn and navigates to /events on confirm", async () => {
    render(
      <Wrapper>
        <DeleteEvent token="tok1" title="Sunset Beach Picnic" />
      </Wrapper>,
    );

    confirmDelete();

    await waitFor(() => {
      expect(deleteEventFn).toHaveBeenCalledWith({ data: { token: "tok1" } });
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/events" });
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast and does not navigate when the delete fails", async () => {
    vi.mocked(deleteEventFn).mockResolvedValue({
      error: "Not the organizer.",
    });
    render(
      <Wrapper>
        <DeleteEvent token="tok1" title="Sunset Beach Picnic" />
      </Wrapper>,
    );

    confirmDelete();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not the organizer.");
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows a generic error toast when deleteEventFn throws", async () => {
    vi.mocked(deleteEventFn).mockRejectedValue(new Error("network down"));
    render(
      <Wrapper>
        <DeleteEvent token="tok1" title="Sunset Beach Picnic" />
      </Wrapper>,
    );

    confirmDelete();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
