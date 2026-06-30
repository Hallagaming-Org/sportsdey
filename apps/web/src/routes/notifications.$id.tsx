import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";

export const Route = createFileRoute("/notifications/$id")({
	component: NotificationDetailPage,
});

type Notification = {
	id: string;
	userId: string;
	title: string;
	message: string;
	read: boolean;
	createdAt: number;
};

function NotificationDetailPage() {
	const { id } = Route.useParams();
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const { data, isLoading, error } = useQuery({
		queryKey: ["notification", id],
		queryFn: () =>
			apiRequest<Notification>(`notifications/${id}`, {
				credentials: "include",
			}),
		enabled: !!session?.user,
	});

	const markAsRead = useMutation({
		mutationFn: (notificationId: string) =>
			apiRequest<Notification>(`notifications/${notificationId}/read`, {
				method: "POST",
				credentials: "include",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
			queryClient.invalidateQueries({ queryKey: ["notification", id] });
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

	if (error || !data) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-20">
				<h2 className="font-bold text-xl">Notification not found</h2>
				<button
					onClick={() => navigate({ to: "/notifications" })}
					className="rounded-lg bg-accent px-6 py-2 font-bold text-[#000606] hover:bg-accent/90"
				>
					Back to Notifications
				</button>
			</div>
		);
	}

	const notification = data;

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<Link
				to="/notifications"
				className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
			>
				<ArrowLeft size={26} />
			</Link>

			<div
				className={`rounded-lg border p-6 ${
					notification.read
						? "border-gray-200 dark:border-gray-700"
						: "border-accent/30 bg-accent/5"
				}`}
			>
				<div className="mb-4 flex items-start justify-between gap-4">
					<h1 className="font-bold text-xl">{notification.title}</h1>
					{!notification.read && (
						<span className="h-3 w-3 shrink-0 rounded-full bg-accent" />
					)}
				</div>

				<p className="whitespace-pre-wrap text-gray-600 dark:text-gray-400 leading-relaxed">
					{notification.message}
				</p>

				<div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
					<span className="text-gray-400 text-sm">
						{formatDistanceToNow(notification.createdAt, {
							addSuffix: true,
						})}
					</span>

					{!notification.read && (
						<button
							type="button"
							onClick={() => markAsRead.mutate(notification.id)}
							disabled={markAsRead.isPending}
							className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-[#000606] transition-colors hover:bg-accent/90 disabled:opacity-50"
						>
							{markAsRead.isPending ? "Marking..." : "Mark as read"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
