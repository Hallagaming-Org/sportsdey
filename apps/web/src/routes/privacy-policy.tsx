import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
	component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
	return (
		<div className="container mx-auto p-8">
			<h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
			<p>Content coming soon...</p>
		</div>
	);
}
