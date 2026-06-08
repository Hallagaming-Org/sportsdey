import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/faqs')({
  component: FAQs,
});

function FAQs() {
  return (
    <div className="p-4 pt-24 min-h-screen text-white max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>
      <p className="text-[#A0A0A0]">FAQs content coming soon...</p>
    </div>
  );
}
