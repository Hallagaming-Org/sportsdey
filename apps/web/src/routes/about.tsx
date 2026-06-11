import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: AboutUsPage,
});

function AboutUsPage() {

  return (
    <div className="min-h-screen bg-[#000606] text-white px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <div className="w-full border pt-4 border-[#1A1A1A] rounded-2xl mb-2 text-[#A0A0A0]">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-left px-6">About Us</h1>
        </div>

        <div className="w-full bg-[#0B100E] border border-[#1A1A1A] rounded-2xl p-8 mb-10 text-[#A0A0A0] leading-relaxed">
          <p className="mb-4">
            SportsDey is a digital sports and entertainment platform designed
            to be a one stop destination for sports fans, bettors, news lovers,
            and gaming enthusiasts. Built by Sports lovers for sports lovers,
            our robust ecosystem offers users access to News, Statistics,
            Sportsbook, Casino, Prediction market, Binary Trading, and
            Esports Tournaments via a unified interface. Sportsdey is owned
            and operated by Halla Gaming Company Limited, a proudly
            Nigerian gaming company licensed by the Cross River State
            Lotteries and Gaming Agency under license No.
            CRSLGA/11/2025/014. Our mission is to provide a safe, fun, and
            rewarding experience aka “beta betting experience” for all eligible
            Nigerians.
          </p>
        </div>
      </div>
    </div>
  );
}
