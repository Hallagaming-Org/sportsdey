import { Facebook, Instagram, Link, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
	url: string;
	title: string;
	className?: string;
}

export const ShareButton = ({ url, title, className }: ShareButtonProps) => {
	const shareUrl = encodeURIComponent(url);
	const shareTitle = encodeURIComponent(title);

	const handleShare = (platform: string, e: any) => {
		e.preventDefault();
		e.stopPropagation();

		let link = "";
		switch (platform) {
			case "x":
				link = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`;
				window.open(link, "_blank");
				break;
			case "facebook":
				link = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
				window.open(link, "_blank");
				break;
			case "whatsapp":
				link = `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`;
				window.open(link, "_blank");
				break;
			case "instagram":
				navigator.clipboard.writeText(url);
				toast.success("Link copied! Share it on Instagram.");
				break;
			case "copy":
				navigator.clipboard.writeText(url);
				toast.success("Link copied to clipboard!");
				break;
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					className={cn(
						"flex cursor-pointer items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100",
						className,
					)}
				>
					<Share2 className="h-4 w-4 text-gray-500" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 z-[100] w-44 animate-in rounded-xl border border-gray-100 bg-white p-2 shadow-xl duration-200 ease-out"
			>
				<DropdownMenuItem
					className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 focus:outline-none"
					onClick={(e) => handleShare("x", e)}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-sm bg-black shadow-sm transition-transform group-hover:scale-105">
						<svg
							viewBox="0 0 24 24"
							className="h-3.5 w-3.5 fill-white"
							aria-hidden="true"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</div>
					<span className="font-semibold text-gray-700 text-sm">
						X (Twitter)
					</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 focus:outline-none"
					onClick={(e) => handleShare("facebook", e)}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#1877F2] shadow-sm transition-transform group-hover:scale-105">
						<Facebook className="h-4 w-4 fill-white text-white" />
					</div>
					<span className="font-semibold text-gray-700 text-sm">Facebook</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 focus:outline-none"
					onClick={(e) => handleShare("instagram", e)}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-sm bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] shadow-sm transition-transform group-hover:scale-105">
						<Instagram className="h-4 w-4 text-white" />
					</div>
					<span className="font-semibold text-gray-700 text-sm">Instagram</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 focus:outline-none"
					onClick={(e) => handleShare("whatsapp", e)}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#25D366] shadow-sm transition-transform group-hover:scale-105">
						<MessageCircle className="h-4 w-4 fill-white text-white" />
					</div>
					<span className="font-semibold text-gray-700 text-sm">WhatsApp</span>
				</DropdownMenuItem>
				<div className="mx-2 my-1 h-px bg-gray-100" />
				<DropdownMenuItem
					className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 focus:outline-none"
					onClick={(e) => handleShare("copy", e)}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-sm bg-gray-100 shadow-sm transition-transform group-hover:scale-105 group-hover:bg-gray-200">
						<Link className="h-4 w-4 text-gray-600" />
					</div>
					<span className="font-semibold text-gray-700 text-sm">Copy Link</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
