import { createFileRoute } from "@tanstack/react-router";
import { CreateEventForm } from "../../features/events/create-event/components/create-event-form";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
});

function CreatePage() {
  return <CreateEventForm />;
}
