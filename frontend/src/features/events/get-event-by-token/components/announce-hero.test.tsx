import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "../../../../lib/i18n";
import type { DateOptionDto } from "@/api/picnivo-api";
import { AnnounceHero } from "./announce-hero";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

const date: DateOptionDto = {
  id: "d1",
  startsAt: "2099-06-20T19:00:00.000Z",
  yesCount: 1,
  maybeCount: 0,
  noCount: 0,
};

describe("AnnounceHero", () => {
  it("renders the announcement info without any RSVP controls", () => {
    render(
      <Wrapper>
        <AnnounceHero
          date={date}
          location="Ocean Beach"
          comingNames={["Maya"]}
          outNames={[]}
          totalParticipants={1}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/It's happening/i)).toBeDefined();
    expect(screen.getByText(/1 of 1 coming/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /I'm in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Can't make it/i })).toBeNull();
  });

  it("shows a can't-make-it strip when someone is out", () => {
    render(
      <Wrapper>
        <AnnounceHero
          date={date}
          comingNames={["Maya"]}
          outNames={["Bob"]}
          totalParticipants={2}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/Bob can't make it/i)).toBeDefined();
  });
});
