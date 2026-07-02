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
import { ItemsEditor } from "./items-editor";
import { ShareLinkDialog } from "./share-link-dialog";
import { DatePicker, MAX_DATES } from "./date-picker";
import { CreateEventForm } from "./create-event-form";

// ---------------------------------------------------------------------------
// vi.mock must be top-level (it is hoisted by vitest)
// ---------------------------------------------------------------------------
vi.mock("../functions", () => ({
  createEventFn: vi.fn(),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// ItemsEditor
// ---------------------------------------------------------------------------
describe("ItemsEditor", () => {
  it("adds an item on Enter", () => {
    const onAdd = vi.fn();
    render(
      <Wrapper>
        <ItemsEditor items={[]} onAdd={onAdd} onRemove={vi.fn()} />
      </Wrapper>,
    );
    const input = screen.getByPlaceholderText(/Add an item/i);
    fireEvent.change(input, { target: { value: "Watermelon" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("Watermelon");
  });

  it("adds an item on button click", () => {
    const onAdd = vi.fn();
    render(
      <Wrapper>
        <ItemsEditor items={[]} onAdd={onAdd} onRemove={vi.fn()} />
      </Wrapper>,
    );
    fireEvent.change(screen.getByPlaceholderText(/Add an item/i), {
      target: { value: "Blanket" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add item/i }));
    expect(onAdd).toHaveBeenCalledWith("Blanket");
  });

  it("ignores duplicate items (case-insensitive)", () => {
    const onAdd = vi.fn();
    render(
      <Wrapper>
        <ItemsEditor items={["Frisbee"]} onAdd={onAdd} onRemove={vi.fn()} />
      </Wrapper>,
    );
    fireEvent.change(screen.getByPlaceholderText(/Add an item/i), {
      target: { value: "frisbee" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Add an item/i), {
      key: "Enter",
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("ignores whitespace-only input", () => {
    const onAdd = vi.fn();
    render(
      <Wrapper>
        <ItemsEditor items={[]} onAdd={onAdd} onRemove={vi.fn()} />
      </Wrapper>,
    );
    fireEvent.change(screen.getByPlaceholderText(/Add an item/i), {
      target: { value: "   " },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Add an item/i), {
      key: "Enter",
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("calls onRemove with the correct index", () => {
    const onRemove = vi.fn();
    render(
      <Wrapper>
        <ItemsEditor
          items={["Cups", "Ice"]}
          onAdd={vi.fn()}
          onRemove={onRemove}
        />
      </Wrapper>,
    );
    const removes = screen.getAllByRole("button", { name: /Remove/i });
    fireEvent.click(removes[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// DatePicker: 1–10 bound
// ---------------------------------------------------------------------------
describe("DatePicker", () => {
  function futureDates(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      d.setHours(0, 0, 0, 0);
      return { date: d, time: "15:00" };
    });
  }

  it("shows remove buttons for each selected date", () => {
    const onChange = vi.fn();
    const sels = futureDates(3);
    render(
      <Wrapper>
        <DatePicker selections={sels} onChange={onChange} />
      </Wrapper>,
    );
    expect(
      screen.getAllByRole("button", { name: /Remove date/i }),
    ).toHaveLength(3);
  });

  it(`renders remove buttons for all ${MAX_DATES} selected dates`, () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <DatePicker selections={futureDates(MAX_DATES)} onChange={onChange} />
      </Wrapper>,
    );
    expect(
      screen.getAllByRole("button", { name: /Remove date/i }),
    ).toHaveLength(MAX_DATES);
  });

  it("calls onChange with one fewer date when remove is clicked", () => {
    const onChange = vi.fn();
    const sels = futureDates(3);
    render(
      <Wrapper>
        <DatePicker selections={sels} onChange={onChange} />
      </Wrapper>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Remove date/i })[0]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ShareLinkDialog
// ---------------------------------------------------------------------------
describe("ShareLinkDialog", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });

  it("displays the share URL containing the token", () => {
    render(
      <Wrapper>
        <ShareLinkDialog
          token="abc123"
          onClose={vi.fn()}
          onOpenEvent={vi.fn()}
        />
      </Wrapper>,
    );
    expect(screen.getByTestId("share-url-box").textContent).toContain(
      "/e/abc123",
    );
  });

  it("calls clipboard.writeText with the URL on copy click", async () => {
    render(
      <Wrapper>
        <ShareLinkDialog
          token="xyz789"
          onClose={vi.fn()}
          onOpenEvent={vi.fn()}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/e/xyz789"),
      );
    });
  });

  it("shows 'Copied!' after clicking copy", async () => {
    render(
      <Wrapper>
        <ShareLinkDialog
          token="abc123"
          onClose={vi.fn()}
          onOpenEvent={vi.fn()}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy link/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Copied!/i })).toBeDefined(),
    );
  });

  it("calls onOpenEvent when 'Open event page' is clicked", () => {
    const onOpenEvent = vi.fn();
    render(
      <Wrapper>
        <ShareLinkDialog
          token="abc123"
          onClose={vi.fn()}
          onOpenEvent={onOpenEvent}
        />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open event page/i }));
    expect(onOpenEvent).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CreateEventForm: stepped navigation & validation
// ---------------------------------------------------------------------------
describe("CreateEventForm", () => {
  it("Continue is disabled on step 0 when title is empty", () => {
    render(
      <Wrapper>
        <CreateEventForm />
      </Wrapper>,
    );
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("Continue is enabled on step 0 when title is filled", () => {
    render(
      <Wrapper>
        <CreateEventForm />
      </Wrapper>,
    );
    fireEvent.change(screen.getByLabelText(/Event name/i), {
      target: { value: "Summer Picnic" },
    });
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Continue is disabled on step 1 when no dates are selected", () => {
    render(
      <Wrapper>
        <CreateEventForm />
      </Wrapper>,
    );
    // Fill title and advance to step 1 (Dates)
    fireEvent.change(screen.getByLabelText(/Event name/i), {
      target: { value: "Summer Picnic" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    // No dates added — Continue on step 1 should be disabled
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
