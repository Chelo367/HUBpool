import CommuteProfileForm from "@/components/CommuteProfileForm";

export default function OnboardingPage() {
  const liveMode = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return <main><CommuteProfileForm liveMode={liveMode} /></main>;
}
