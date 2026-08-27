import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  authClient,
  loginWithPhone,
  PENDING_PHONE_PASSWORD_KEY,
  requestPhoneOtp,
  signIn,
} from "@/lib/auth/client";
import { needsPhoneProfileCompletion } from "@/lib/auth/phone-user";
import { showAppleFacebookLogin } from "@/lib/auth/social-logins";
import { buildPublicUrl } from "@/lib/public-url";
import {
  loginWebengageUser,
  trackWebengageLoginInitiated,
} from "@/lib/webengage";
import { Lock, Eye, EyeOff } from "lucide-react";
import z from "zod";

const phoneSignInSearchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().catch("login"),
  returnTo: z.string().optional().catch(""),
});

export const Route = createFileRoute("/auth/phone-sign-in")({
  validateSearch: phoneSignInSearchSchema,
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
  const { mode, returnTo } = Route.useSearch();
  const isSignUp = mode === "signup";
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canContinue = useMemo(() => {
    const normalizedLength = phoneNumber.replace(/\D/g, "").length;
    return (
      (!isSignUp || acceptedTerms) &&
      password.length >= 6 &&
      (normalizedLength === 10 ||
        normalizedLength === 11 ||
        normalizedLength === 13)
    );
  }, [phoneNumber, password, acceptedTerms, isSignUp]);

  const handleContinue = async () => {
    if (!canContinue) return;

    const phone = normalizePhoneNumber(phoneNumber);
    if (!phone) {
      setError("Please enter a valid phone number.");
      return;
    }

    setError("");
    setIsLoading(true);
    trackWebengageLoginInitiated("phone");

    try {
      if (isSignUp) {
        sessionStorage.setItem(PENDING_PHONE_PASSWORD_KEY, password);
        await requestPhoneOtp(phone);
        navigate({
          to: "/auth/otp",
          search: {
            phone,
            flow: "signup",
            referralCode: referralCode.trim() || undefined,
          },
        });
        return;
      }

      const data = await loginWithPhone(phone, password);
      const session = await authClient.getSession();
      if (!session?.data?.session) {
        throw new Error(
          "Sign-in succeeded but session was not established. Please try again.",
        );
      }
      authClient.$store.notify("$sessionSignal");
      loginWebengageUser(data.user.id);

      if (
        needsPhoneProfileCompletion({
          ...data.user,
          isFirstTimeSignIn: data.isFirstTimeSignIn,
          needsProfileCompletion: data.needsProfileCompletion,
        })
      ) {
        navigate({
          to: "/auth/complete-profile",
          search: {
            phone,
          },
        });
        return;
      }

      if (returnTo) {
        navigate({ to: returnTo });
        return;
      }

      navigate({ to: "/", search: { league: "sports", sports: "football" } });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isSignUp
            ? "Failed to send OTP. Please try again."
            : "Failed to log in. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const callbackURL = returnTo
    ? buildPublicUrl(
        `/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      )
    : buildPublicUrl("/auth/callback");

  const handleSocialSignIn = async (
    provider: "google" | "apple" | "facebook",
  ) => {
    if (provider !== "google" && !showAppleFacebookLogin()) return;
    setError("");
    setIsLoading(true);
    trackWebengageLoginInitiated(provider);
    try {
      const result = await signIn.social({
        provider,
        callbackURL,
      });
      if (result?.error) {
        setError(result.error.message || `Failed to sign in with ${provider}`);
      }
    } catch {
      setError(`Failed to sign in with ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-60px)] items-start justify-center bg-white px-4 pt-24 pb-10 lg:min-h-[calc(100svh-80px)] lg:pt-28">
      <div className="w-full max-w-[530px]">
        <div className="mb-10 text-center">
          <h1 className="font-bold text-[32px] text-[#0a0f0d] leading-tight">
            {isSignUp ? "Sign up to your account" : "Log in to your account"}
          </h1>
          {isSignUp ? (
            <p className="mt-2 font-medium text-[#6f7471] text-sm">
              Step 1 of 3
            </p>
          ) : (
            <p className="mt-2 text-[#0a0f0d] text-base font-medium">
              It's quick, easy, and enjoyable.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex h-[91px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 transition-colors focus-within:border-[#17b000] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 pr-4">
              <span className="text-xl">🇳🇬</span>
              <span className="font-medium text-[#6f7471] text-base">+234</span>
            </div>
            <div className="h-8 w-px bg-[#bcbcbc]" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => {
                const numericValue = event.target.value.replace(/[^0-9]/g, "");
                setPhoneNumber(numericValue);
              }}
              placeholder="012 345 6789"
              className="w-full bg-transparent px-4 text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
            />
          </div>

          <div>
            <div className="flex h-[91px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 transition-colors focus-within:border-[#17b000] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <Lock className="text-[#9a9d9a] shrink-0" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                className="w-full bg-transparent px-4 text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#9a9d9a] focus:outline-none shrink-0"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {!isSignUp && (
              <div className="mt-2 flex justify-end pr-2">
                <button
                  type="button"
                  onClick={() => {
                    const normalized = normalizePhoneNumber(phoneNumber);
                    navigate({
                      to: "/auth/forgot-password",
                      search: {
                        phone: normalized || undefined,
                      },
                    });
                  }}
                  className="text-sm font-medium text-[#17b000] cursor-pointer underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {isSignUp && (
            <div className="relative flex h-[91px] items-center rounded-[20px] border border-[#dbdbdb] bg-white px-4 transition-colors focus-within:border-[#17b000] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <input
                type="text"
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value)}
                placeholder="Referral Code (e.g 123456)"
                className="w-full bg-transparent pr-20 text-[#0a0f0d] text-base outline-none placeholder:text-[#9a9d9a]"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9a9d9a] text-sm">
                (optional)
              </span>
            </div>
          )}
        </div>

        {isSignUp && (
          <label className="mt-6 flex cursor-pointer items-start gap-3 text-[#8f9491] text-sm leading-tight">
            <input
              type="checkbox"
              className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-transparent bg-[#EBE9F4] accent-[#17b000]"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              I confirm that I am 18 years or older, understand and agree to the{" "}
              <Link to="/terms" className="font-medium text-[#17b000] underline">
                Terms & Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="font-medium text-[#17b000] underline">
                Privacy policy
              </Link>
              .
            </span>
          </label>
        )}

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-left text-red-700 text-sm">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue || isLoading}
          className="mt-8 w-full rounded-2xl bg-[#17b000] py-[18px] font-semibold text-lg text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
        >
          {isLoading
            ? isSignUp
              ? "Sending OTP..."
              : "Logging in..."
            : isSignUp
              ? "Continue"
              : "Log in"}
        </button>

        <div className="mt-8 flex items-center">
          <div className="h-px flex-1 bg-[#8C8C8C]"></div>
          <span className="text-[#9a9d9a] text-sm py-2 border border-[#8C8C8C] px-6 rounded-full">or</span>
          <div className="h-px flex-1 bg-[#8C8C8C]"></div>
        </div>

        <div className="mt-6 text-center">
          <p className="mb-4 text-[#6f7471] text-sm font-medium">Other login methods</p>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleSocialSignIn("google")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100 transition-transform hover:scale-105 disabled:opacity-50"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </button>
            {showAppleFacebookLogin() ? (
              <>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleSocialSignIn("apple")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black transition-transform hover:scale-105 disabled:opacity-50"
                >
                  <svg className="h-6 w-6" fill="white" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleSocialSignIn("facebook")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1877F2] transition-transform hover:scale-105 disabled:opacity-50"
                >
                  <svg className="h-6 w-6" fill="white" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#6f7471]">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <Link
                  to="/auth/phone-sign-in"
                  search={{ mode: "login", returnTo }}
                  className="font-medium text-[#17b000] underline"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Link
                  to="/auth/phone-sign-in"
                  search={{ mode: "signup", returnTo }}
                  className="font-medium text-[#17b000] underline"
                >
                  Sign up
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

