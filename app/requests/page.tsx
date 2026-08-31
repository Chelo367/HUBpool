import RequestList from "@/components/RequestList";

export default function RequestsPage() {
  return (
    <main>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Carpool connections</p>
          <h1 className="pageTitle">Requests & contacts</h1>
          <p className="lede">Send a request to a compatible coworker. Once accepted, HUBpool reveals the phone number so both people can arrange exact pickup details privately.</p>
        </div>
      </div>
      <RequestList />
    </main>
  );
}
