import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import { CreateEventForm } from "./create-event-form";

// Stub DatePicker: renders a button that immediately injects one future date,
// avoiding calendar interaction in jsdom.
vi.mock("./date-picker", () => ({
  DatePicker: ({
    onChange,
  }: {
    onChange: (sels: { date: Date; time: string }[]) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-add-date"
      onClick={() =>
        onChange([
          {
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            time: "15:00",
          },
        ])
      }
    >
      Add date
    </button>
  ),
  MAX_DATES: 10,
}));

vi.mock("../functions", () => ({
  createEventFn: vi.fn(),
}));

import { createEventFn } from "../functions";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

/** Navigate through the stepped form and arrive at the Create button. */
async function fillAndReachSubmit() {
  // Step 0 (Basics): fill title → Continue
  fireEvent.change(screen.getByLabelText(/Event name/i), {
    target: { value: "Summer Picnic" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

  // Step 1 (Dates): add a date → Continue
  fireEvent.click(screen.getByTestId("mock-add-date"));
  fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
  // Now on step 2 (Items) — Create & get link button is visible
}

describe("CreateEventForm — submit flow", () => {
  beforeEach(() => {
    vi.mocked(createEventFn).mockReset();
  });

  it("shows the share dialog after a successful submit", async () => {
    vi.mocked(createEventFn).mockResolvedValue({
      token: "abc123",
      id: "1",
      error: null,
    });

    render(
      <Wrapper>
        <CreateEventForm />
      </Wrapper>,
    );

    await fillAndReachSubmit();
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /Create/i })
        .find((b) => (b as HTMLButtonElement).type === "submit")!,
    );

    await waitFor(() => {
      expect(screen.getByText(/Your picnic is live!/i)).toBeDefined();
    });
  });

  it("ignores a native form submit triggered before the final step", async () => {
    // Regression test: the wizard is a single <form> spanning all steps.
    // The browser can submit it natively (e.g. implicit submission on Enter
    // in the date's time input) before the user ever reaches the final step
    // and clicks "Create & get link". The handler must ignore that.
    vi.mocked(createEventFn).mockResolvedValue({
      token: "abc123",
      id: "1",
      error: null,
    });

    render(
      <Wrapper>
        <CreateEventForm />
      </Wrapper>,
    );

    // Step 0: fill title → Continue
    fireEvent.change(screen.getByLabelText(/Event name/i), {
      target: { value: "Summer Picnic" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    // Step 1 (Dates): add a date, then simulate the browser submitting the
    // form natively — canCreate's underlying fields (title + a date) are
    // already satisfied here, even though we're not on the final step.
    fireEvent.click(screen.getByTestId("mock-add-date"));
    fireEvent.submit(
      screen.getByRole("button", { name: /Continue/i }).closest("form")!,
    );

    expect(createEventFn).not.toHaveBeenCalled();
    expect(screen.queryByText(/Your picnic is live!/i)).toBeNull();
  });

  it("shows an error alert when createEventFn returns an error", async () => {
    vi.mocked(createEventFn).mockResolvedValue({
      token: null,
      id: null,
      error: "Server error",
    });

    render(
      <Wrapper>
        <CreateEventForm />
      </Wrapper>,
    );

    await fillAndReachSubmit();
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /Create/i })
        .find((b) => (b as HTMLButtonElement).type === "submit")!,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
  });
});
