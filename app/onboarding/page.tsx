import AuthRequired from "@/components/AuthRequired";
import CommuteProfileForm from "@/components/CommuteProfileForm";
import OrganizationGate from "@/components/OrganizationGate";

export default function OnboardingPage() {
  return (
    <AuthRequired>
      <OrganizationGate>
        <CommuteProfileForm />
      </OrganizationGate>
    </AuthRequired>
  );
}