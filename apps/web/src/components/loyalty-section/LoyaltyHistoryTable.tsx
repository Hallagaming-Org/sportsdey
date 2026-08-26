import { formatDistanceToNow } from "date-fns";
import type { LoyaltyHistoryEntry } from "@/lib/loyalty";

type LoyaltyHistoryTableProps = {
	entries: LoyaltyHistoryEntry[];
};

export function LoyaltyHistoryTable({ entries }: LoyaltyHistoryTableProps) {
	return (
		<section className="overflow-hidden rounded-2xl border border-[#1B2722] bg-[#151616]">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[520px] text-left text-sm">
					<thead>
						<tr className="border-b border-[#1B2722] text-[#8C8F8F]">
							<th className="px-4 py-3 font-medium sm:px-6">#</th>
							<th className="px-4 py-3 font-medium sm:px-6">Activities</th>
							<th className="px-4 py-3 font-medium sm:px-6">XP</th>
							<th className="px-4 py-3 font-medium sm:px-6">Time &amp; Date</th>
						</tr>
					</thead>
					<tbody>
						{entries.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-4 py-3 text-center text-[#8C8F8F] sm:px-6">
									No recent activity
								</td>
							</tr>
						) : (
							entries.map((entry, index) => (
								<tr
									key={entry.id}
									className="border-b border-[#1B2722] last:border-b-0"
								>
									<td className="px-4 py-4 text-[#8C8F8F] sm:px-6">{index + 1}</td>
									<td className="px-4 py-4 font-medium text-white sm:px-6">
										{entry.activity}
									</td>
									<td
										className={`px-4 py-4 font-semibold sm:px-6 ${
											entry.xpDelta >= 0 ? "text-accent" : "text-[#8C8F8F]"
										}`}
									>
										{formatXpDelta(entry.xpDelta)}
									</td>
									<td className="px-4 py-4 text-[#8C8F8F] sm:px-6">
										{formatOccurredAt(entry.occurredAt)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function formatXpDelta(delta: number): string {
	if (delta > 0) return `+ ${delta.toLocaleString()} XP`;
	if (delta < 0) return `− ${Math.abs(delta).toLocaleString()} XP`;
	return "0 XP";
}

function formatOccurredAt(value: string | null): string {
	if (!value) return "—";
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) return value;
	return formatDistanceToNow(parsed, { addSuffix: true });
}
