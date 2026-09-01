import AuthRequired from "@/components/AuthRequired";
import LiveMatches from "@/components/LiveMatches";
import OrganizationGate from "@/components/OrganizationGate";

export default function MatchesPage() {
  return (
    <AuthRequired>
      <OrganizationGate>
        <LiveMatches />
      </OrganizationGate>
    </AuthRequired>
  );
}