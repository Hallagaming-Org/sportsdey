import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const defaultAmountFormat: Intl.NumberFormatOptions = {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
};

export function formatAmount(
	value: number | null | undefined,
	options?: Intl.NumberFormatOptions,
): string {
	const amount = Number(value);
	const safeAmount = Number.isFinite(amount) ? amount : 0;
	return safeAmount.toLocaleString("en-NG", {
		...defaultAmountFormat,
		...options,
	});
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleString("en-NG");
}

export function formatTime(date: Date): string {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function formatDateTimeWithoutSeconds(
	dateTimeString: string | undefined | null,
): string {
	if (!dateTimeString) return "";

	const normalized = dateTimeString
		.replace("T", " ")
		.replace(/[+-]\d{2}:\d{2}$/, "");
	const parts = normalized.split(" ");
	if (parts.length < 2) return dateTimeString;

	const [date, timeWithSeconds] = parts;

	const timeWithoutSeconds = timeWithSeconds.slice(0, -3);

	return `${date} ${timeWithoutSeconds}`;
}

export function formatClock(playedMinutesStr: number | string) {
	if (typeof playedMinutesStr === "string") {
		return playedMinutesStr;
	}
	const minutes = playedMinutesStr;
	const seconds = 0;

	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatRelativeTime(dateString: string | Date): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) {
		return "just now";
	}

	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) {
		return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
	}

	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) {
		return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
	}

	const diffInDays = Math.floor(diffInHours / 24);
	if (diffInDays < 7) {
		return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
	}

	const diffInWeeks = Math.floor(diffInDays / 7);
	if (diffInWeeks < 4) {
		return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
	}

	const diffInMonths = Math.floor(diffInDays / 30);
	if (diffInMonths < 12) {
		return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`;
	}

	const diffInYears = Math.floor(diffInDays / 365);
	return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`;
}

// async function searchYouTubeVideos(topic) {
// 	const API_KEY = "YOUR_API_KEY"; // Replace with your actual API key
// 	const BASE_URL = "https://www.googleapis.com/youtube/v3/search";

// 	// Construct the URL for the API request
// 	// - part=snippet: Specifies that the API response will include the snippet resource property.
// 	// - q=${topic}: Sets the search query to your desired topic.
// 	// - type=video: Restricts the search to only retrieve video resources.
// 	// - maxResults=5: Limits the number of results to 5 (you can adjust this).
// 	// - key=${API_KEY}: Your YouTube Data API key.
// 	const url = `${BASE_URL}?part=snippet&q=${encodeURIComponent(topic)}&type=video&maxResults=5&key=${API_KEY}`;

// 	try {
// 		const response = await fetch(url); // Make the API request
// 		const data = await response.json(); // Parse the JSON response

// 		if (data.items && data.items.length > 0) {
// 			console.log(`Found videos for topic: "${topic}"`);
// 			data.items.forEach((item) => {
// 				const videoId = item.id.videoId;
// 				const videoTitle = item.snippet.title;
// 				console.log(`Video ID: ${videoId}, Title: "${videoTitle}"`);

// 				// Now you have the videoId, which you can use to embed the video.
// 				// For example, to create an iframe:
// 				// const embedUrl = `https://www.youtube.com/embed/${videoId}`;
// 				// console.log(`Embed URL: ${embedUrl}`);

// 				// You would typically dynamically add this to your HTML:
// 				// const iframe = document.createElement('iframe');
// 				// iframe.width = "560";
// 				// iframe.height = "315";
// 				// iframe.src = embedUrl;
// 				// iframe.frameBorder = "0";
// 				// iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
// 				// iframe.allowFullscreen = true;
// 				// document.getElementById('video-container').appendChild(iframe); // Assuming you have a div with id 'video-container'
// 			});
// 		} else {
// 			console.log(`No videos found for topic: "${topic}"`);
// 		}
// 	} catch (error) {
// 		console.error("Error fetching YouTube videos:", error);
// 	}
// }

// // Example usage:
// // searchYouTubeVideos('JavaScript tutorial');
// // searchYouTubeVideos('cute cats');
