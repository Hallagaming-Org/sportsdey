const VenueGuide = ({ venueName }: { venueName: string }) => {
	return (
		<div className="h-10 w-full rounded-full bg-white dark:bg-card">
			<div className="flex h-full w-full items-center justify-between px-4">
				<p className="font-semibold text-primary text-xs md:text-sm dark:text-white">
					Venue Guide
				</p>
				<p className="text-[#040C01] text-[10px] dark:text-white">
					{venueName}
				</p>
			</div>
		</div>
	);
};

export default VenueGuide;
