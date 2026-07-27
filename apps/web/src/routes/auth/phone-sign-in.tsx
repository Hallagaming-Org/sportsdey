import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { requestPhoneOtp } from "@/lib/auth/client";

export const Route = createFileRoute("/auth/phone-sign-in")({
  component: PhoneSignInPage,
});

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 11) {
    return digits;
  }
  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  return digits;
};

function PhoneSignInPage() {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canContinue = useMemo(() => {
    const normalizedLength = phoneNumber.replace(/\D/g, "").length;
    return (
      acceptedTerms &&
      (normalizedLength === 10 ||
        normalizedLength === 11 ||
        normalizedLength === 13)
    );
  }, [phoneNumber, acceptedTerms]);

  const handleContinue = async () => {
    if (!canContinue) return;

    const phone = normalizePhoneNumber(phoneNumber);
    if (!phone) {
      setError("Please enter a valid phone number.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await requestPhoneOtp(phone);
      navigate({
        to: "/auth/otp",
        search: {
          phone,
          referralCode: referralCode.trim() || undefined,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send OTP. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-60px)] items-start justify-center bg-[#ebebeb] px-4 pt-24 pb-10 lg:min-h-[calc(100svh-80px)] lg:pt-28">
      <div className="w-full max-w-[530px]">
        <div className="mb-8 text-center">
          <h1 className="font-bold text-2xl text-[#0a0f0d] leading-tight">
            Log in to your account
          </h1>
          <p className="mt-3 text-[#0a0f0d] text-base font-medium">
            It's quick, easy, and enjoyable.
          </p>
        </div>

        <div className="rounded-2xl border border-[#dbdbdb] bg-[#f5f5f5] p-3">
          <div className="flex items-center">
            <div className="flex items-center gap-3 pr-4">
              <span className="text-base">🇳🇬</span>
              <span className="font-semibold text-[#6f7471] text-base">
                +234
              </span>
            </div>
            <div className="h-14 w-px bg-[#bcbcbc]" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="345678990"
              className="w-full bg-transparent px-2 py-1 text-[#7b7f7c] text-sm outline-none placeholder:text-[#9a9d9a]"
            />
          </div>
        </div>
        <div className="relative mt-6">
          <input
            type="text"
            value={referralCode}
            onChange={(event) => setReferralCode(event.target.value)}
            placeholder="Enter referral code"
            className="w-full rounded-2xl border border-[#dbdbdb] bg-[#f5f5f5] px-3 py-[30px] pr-20 text-[#7b7f7c] text-sm outline-none placeholder:text-[#9a9d9a]"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#9a9d9a] text-sm">
            (optional)
          </span>
        </div>

        <label className="mt-10 flex cursor-pointer items-start gap-3 text-[#8f9491] text-sm leading-tight">
          <input
            type="checkbox"
            className="mt-2 h-4 w-4 shrink-0 accent-[#18b100]"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span >
            By continuing, you confirm that you are 18 years or older, understand and agree to our{" "}
            <Link to="/terms" className="font-medium text-[#18b100] underline">
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy-policy"
              className="font-medium text-[#18b100] underline"
            >
              Privacy policy
            </Link>
            .
          </span>
        </label>

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue || isLoading}
          className="mt-6 w-full rounded-2xl bg-[#17b000] py-6 font-medium text-sm text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Sending OTP..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
