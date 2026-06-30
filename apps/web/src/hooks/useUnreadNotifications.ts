import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";

type UnreadCountResponse = {
	count: number;
};

export function useUnreadNotifications() {
	const { data: session } = useSession();

	return useQuery({
		queryKey: ["unread-notifications"],
		queryFn: () =>
			apiRequest<UnreadCountResponse>("notifications/unread-count", {
				credentials: "include",
			}),
		enabled: !!session?.user,
		refetchInterval: 30 * 1000,
		retry: true,
	});
}
