import { createFileRoute, redirect } from "@tanstack/react-router";
import { accountQuery } from "@/hooks/use-account";

// Sends each signed-in user to their own area (or the next setup step).
export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    const account = await context.queryClient.ensureQueryData(accountQuery);
    if (!account) throw redirect({ to: "/auth", search: { mode: "signin" } });
    throw redirect({ to: account.home });
  },
});
