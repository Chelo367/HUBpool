import MatchCard from "@/components/MatchCard";
import LiveMatches from "@/components/LiveMatches";
import { DEMO_MATCHES } from "@/lib/demo-data";

export default function MatchesPage() {
  const liveMode = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return (
    <main>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">{liveMode ? "Shared coworker pilot" : "Cached route matches"}</p>
          <h1 className="pageTitle">People who could share the commute.</h1>
          <p className="lede">
            {liveMode
              ? "Real registered coworkers are compared by role and this week's schedule. Google route compatibility is the next layer we will connect."
              : "Route compatibility stays cached. Your current weekly schedule is layered on top in real time with no new Maps request."}
          </p>
        </div>
      </div>

      {liveMode ? (
        <LiveMatches />
      ) : (
        <>
          <div className="matchList">
            {DEMO_MATCHES.map((match) => <MatchCard key={match.id} match={match} />)}
          </div>
          <p className="footerNote">Demo data for the UI. Connect Supabase to replace these cards with real registered coworkers.</p>
        </>
      )}
    </main>
  );
}
