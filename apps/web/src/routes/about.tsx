import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: AboutUsPage,
});

function AboutUsPage() {

  return (
    <div className="min-h-screen bg-[#000606] text-white py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* Header */}
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-center">About Us</h1>
        <p className="text-[#A0A0A0] mb-8 text-center text-sm sm:text-base">
          Learn more about SportsDey and our mission.
        </p>

        {/* Content Placeholder */}
        <div className="w-full bg-[#0B100E] border border-[#1A1A1A] rounded-2xl p-8 mb-10 text-[#A0A0A0] leading-relaxed">
          <p className="mb-4">
            Welcome to SportsDey. We are committed to providing the best sports betting and entertainment experience.
            (This is a placeholder for your About Us content. You can replace this text with your actual company information.)
          </p>
        </div>
      </div>
    </div>
  );
}
