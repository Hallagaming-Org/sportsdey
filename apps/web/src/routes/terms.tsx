import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
	component: TermsPage,
});

function TermsPage() {
	return (
		<div className="container mx-auto p-8">
			<h1 className="text-3xl font-bold mb-4">Terms and Conditions</h1>
			<p>Content coming soon...</p>
		</div>
	);
}
