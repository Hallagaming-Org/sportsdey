type TournamentHeroProps = {
	title: string;
	disabled?: boolean;
	onJoin: () => void;
};

export function TournamentHero({
	title,
	disabled = false,
	onJoin,
}: TournamentHeroProps) {
	return (
		<button
			type="button"
			onClick={onJoin}
			disabled={disabled}
			aria-label={`Join ${title}`}
			className="block w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-default"
		>
			<img
				src="/hero.png"
				alt={`${title}. Join tournament`}
				className="h-auto w-full"
			/>
		</button>
	);
}
