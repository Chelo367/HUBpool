import AuthRequired from "@/components/AuthRequired";
import OrganizationAdmin from "@/components/OrganizationAdmin";
import OrganizationGate from "@/components/OrganizationGate";

export default function OrganizationPage() {
  return (
    <AuthRequired>
      <OrganizationGate>
        <OrganizationAdmin />
      </OrganizationGate>
    </AuthRequired>
  );
}