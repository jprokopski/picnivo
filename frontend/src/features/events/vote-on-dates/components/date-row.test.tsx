import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import type { DateOptionDto } from "@/api/picnivo-api";
import { DateRow } from "./date-row";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

const date: DateOptionDto = {
  id: "d1",
  startsAt: "2099-06-20T19:00:00.000Z",
  yesCount: 3,
  maybeCount: 1,
  noCount: 2,
};

describe("DateRow", () => {
  it("renders vote tallies from the counts", () => {
    render(
      <Wrapper>
        <DateRow
          token="tok1"
          date={date}
          isBest={false}
          locked={false}
          joined={false}
          yesVoterNames={[]}
        />
      </Wrapper>,
    );

    expect(screen.getByText("3 yes")).toBeDefined();
    expect(screen.getByText("1 maybe")).toBeDefined();
    expect(screen.getByText("2 no")).toBeDefined();
  });

  it("shows a Leading chip on the best date when not locked", () => {
    render(
      <Wrapper>
        <DateRow
          token="tok1"
          date={date}
          isBest={true}
          locked={false}
          joined={false}
          yesVoterNames={[]}
        />
      </Wrapper>,
    );

    expect(screen.getByText("Leading")).toBeDefined();
  });

  it("shows a Locked chip on the best date once chosen", () => {
    render(
      <Wrapper>
        <DateRow
          token="tok1"
          date={date}
          isBest={true}
          locked={true}
          joined={false}
          yesVoterNames={[]}
        />
      </Wrapper>,
    );

    expect(screen.getByText("✓ Locked")).toBeDefined();
  });

  it("shows no chip when the row isn't the best date", () => {
    render(
      <Wrapper>
        <DateRow
          token="tok1"
          date={date}
          isBest={false}
          locked={true}
          joined={false}
          yesVoterNames={[]}
        />
      </Wrapper>,
    );

    expect(screen.queryByText("Leading")).toBeNull();
    expect(screen.queryByText("✓ Locked")).toBeNull();
  });

  it("only renders the vote control once joined", () => {
    const { rerender } = render(
      <Wrapper>
        <DateRow
          token="tok1"
          date={date}
          isBest={false}
          locked={false}
          joined={false}
          yesVoterNames={[]}
        />
      </Wrapper>,
    );
    expect(screen.queryAllByRole("group", { name: "Vote" })).toHaveLength(0);

    rerender(
      <Wrapper>
        <DateRow
          token="tok1"
          date={date}
          isBest={false}
          locked={false}
          joined={true}
          yesVoterNames={[]}
        />
      </Wrapper>,
    );
    // Both the desktop and mobile variants render; CSS decides which shows.
    expect(screen.getAllByRole("group", { name: "Vote" })).toHaveLength(2);
  });
});
