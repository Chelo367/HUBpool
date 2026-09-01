import LiveRequestList from "@/components/LiveRequestList";
import RequestList from "@/components/RequestList";

export default function RequestsPage() {
  const liveMode = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return (
    <main>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Carpool connections {liveMode && "· live"}</p>
          <h1 className="pageTitle">Requests & contacts</h1>
          <p className="lede">Send a request to a compatible coworker. Once accepted, HUBpool reveals the phone number so both people can arrange exact pickup details privately.</p>
        </div>
      </div>
      {liveMode ? <LiveRequestList /> : <RequestList />}
    </main>
  );
}
