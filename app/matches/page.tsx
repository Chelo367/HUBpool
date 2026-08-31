import MatchCard from "@/components/MatchCard";
import { DEMO_MATCHES } from "@/lib/demo-data";

export default function MatchesPage() {
  return (
    <main>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Cached route matches</p>
          <h1 className="pageTitle">People already on your way.</h1>
          <p className="lede">Route compatibility stays cached. Your current weekly schedule is layered on top in real time with no new Maps request.</p>
        </div>
      </div>
      <div className="matchList">
        {DEMO_MATCHES.map((match) => <MatchCard key={match.id} match={match} />)}
      </div>
      <p className="footerNote">Demo data for the UI. In production, phone details remain private until a carpool request is accepted.</p>
    </main>
  );
}
