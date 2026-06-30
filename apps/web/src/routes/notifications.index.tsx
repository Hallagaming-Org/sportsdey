import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell, ChevronRight, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";

export const Route = createFileRoute("/notifications/")({
	component: NotificationsListPage,
});

type Notification = {
	id: string;
	userId: string;
	title: string;
	message: string;
	read: boolean;
	createdAt: number;
};

type NotificationsResponse = {
	notifications: Notification[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
};

function NotificationsListPage() {
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const { data, isLoading } = useQuery({
		queryKey: ["notifications"],
		queryFn: () =>
			apiRequest<NotificationsResponse>("notifications", {
				credentials: "include",
			}),
		enabled: !!session?.user,
	});

	const markAsRead = useMutation({
		mutationFn: (id: string) =>
			apiRequest<Notification>(`notifications/${id}/read`, {
				method: "POST",
				credentials: "include",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
		},
	});

	if (!session?.user) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<p className="text-gray-500">Please sign in to view notifications.</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-accent" />
			</div>
		);
	}

	const notifications = data?.notifications ?? [];

	function truncate(text: string, maxLen: number) {
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen).trimEnd() + "...";
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<div className="mb-6 flex items-center gap-3">
				<Bell className="h-6 w-6" />
				<h1 className="font-bold text-2xl">Notifications</h1>
			</div>

			{notifications.length === 0 ? (
				<div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-gray-500">
					<Bell className="h-12 w-12" />
					<p className="text-lg">No notifications yet</p>
				</div>
			) : (
				<div className="space-y-3">
					{notifications.map((notification) => (
						<button
							key={notification.id}
							type="button"
							onClick={() => {
								if (!notification.read) {
									markAsRead.mutate(notification.id);
								}
								navigate({ to: "/notifications/$id", params: { id: notification.id } });
							}}
							className={`w-full cursor-pointer rounded-lg border p-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
								notification.read
									? "border-gray-200 dark:border-gray-700"
									: "border-accent/30 bg-accent/5"
							}`}
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<h3
										className={`font-semibold ${
											notification.read
												? "text-gray-700 dark:text-gray-300"
												: "text-foreground"
										}`}
									>
										{notification.title}
									</h3>
									<p className="mt-1 text-gray-500 text-sm">
										{truncate(notification.message, 120)}
									</p>
								</div>
								<div className="flex shrink-0 flex-col items-end gap-2">
									<span className="whitespace-nowrap text-gray-400 text-xs">
										{formatDistanceToNow(notification.createdAt, {
											addSuffix: true,
										})}
									</span>
									{!notification.read && (
										<span className="h-2 w-2 rounded-full bg-accent" />
									)}
									<ChevronRight className="h-4 w-4 text-gray-400" />
								</div>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
