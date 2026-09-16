type TournamentHeroProps = {
	onJoin: () => void;
};

export function TournamentHero({ onJoin }: TournamentHeroProps) {
	return (
		<button
			type="button"
			onClick={onJoin}
			aria-label="Join Weekend Football Challenge"
			className="block w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
		>
			<img
				src="/hero.png"
				alt="Weekend Football Challenge, prize ₦2,000,000. Join tournament"
				className="h-auto w-full"
			/>
		</button>
	);
}
