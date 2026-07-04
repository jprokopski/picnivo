import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteEventFn } from "../functions";

interface DeleteEventProps {
  token: string;
  title: string;
}

export function DeleteEvent({ token, title }: DeleteEventProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await deleteEventFn({ data: { token } });
      if (result.error) {
        toast.error(result.error || t`Something went wrong. Please try again.`);
        return;
      }
      navigate({ to: "/events" });
    } catch {
      toast.error(t`Something went wrong. Please try again.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full gap-2">
          <Trash2Icon className="size-4" />
          <Trans>Delete event</Trans>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Delete "{title}"?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              This permanently deletes the event and all participants, votes,
              and claimed items. This can't be undone.
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
          >
            <Trans>Delete event</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
