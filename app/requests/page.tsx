import AuthRequired from "@/components/AuthRequired";
import LiveRequestList from "@/components/LiveRequestList";
import OrganizationGate from "@/components/OrganizationGate";

export default function RequestsPage() {
  return (
    <AuthRequired>
      <OrganizationGate>
        <LiveRequestList />
      </OrganizationGate>
    </AuthRequired>
  );
}