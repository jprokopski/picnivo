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
import type { EventItemDto } from "@/api/picnivo-api";
import { AddItem } from "./add-item";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("../functions", () => ({
  addItemFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { addItemFn } from "../functions";
import { toast } from "sonner";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.mocked(addItemFn).mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  invalidate.mockClear();
});

function item(label: string): EventItemDto {
  return {
    id: label,
    label,
    claimedByParticipantId: null,
    claimedByName: null,
    addedByParticipantId: null,
    orphanedFromName: null,
  };
}

describe("AddItem", () => {
  it("adds an item and invalidates the router", async () => {
    render(
      <Wrapper>
        <AddItem token="tok1" items={[]} joined={true} active={true} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/add something/i), {
      target: { value: "Chips" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(addItemFn).toHaveBeenCalledWith({
        data: { token: "tok1", label: "Chips" },
      });
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("blocks a case-insensitive duplicate label without calling addItemFn", () => {
    render(
      <Wrapper>
        <AddItem
          token="tok1"
          items={[item("Watermelon")]}
          joined={true}
          active={true}
        />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/add something/i), {
      target: { value: "watermelon" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    expect(screen.getByText(/already on the list/i)).toBeDefined();
    expect(addItemFn).not.toHaveBeenCalled();
  });

  it("disables the input and button when not active", () => {
    render(
      <Wrapper>
        <AddItem token="tok1" items={[]} joined={true} active={false} />
      </Wrapper>,
    );

    expect(
      (
        screen.getByPlaceholderText(
          /confirm you're coming to add/i,
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /add item/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows a join prompt when the visitor hasn't joined", () => {
    render(
      <Wrapper>
        <AddItem token="tok1" items={[]} joined={false} active={false} />
      </Wrapper>,
    );

    expect(screen.getByPlaceholderText(/join to add items/i)).toBeDefined();
  });

  it("surfaces a server error via toast without clearing the input", async () => {
    vi.mocked(addItemFn).mockResolvedValue({ error: "The list is full." });
    render(
      <Wrapper>
        <AddItem token="tok1" items={[]} joined={true} active={true} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/add something/i), {
      target: { value: "Chips" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("The list is full.");
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
