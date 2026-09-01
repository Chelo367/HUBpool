import Link from "next/link";

export default function HomePage() {
  const liveMode = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return (
    <main>
      <section className="hero">
        <div className="heroCard heroPrimary">
          <p className="eyebrow eyebrowOnDark">Valencia HUB · smarter commuting</p>
          <h1>One HUB.<br />Fewer cars.</h1>
          <p className="lede ledeOnDark">
            HUBpool connects colleagues whose commute to the same office can realistically be shared — while keeping private details protected and routing costs tiny.
          </p>
          <div className="actions">
            <Link className="button buttonSand" href={liveMode ? "/auth" : "/onboarding"}>{liveMode ? "Join the live pilot" : "Set up my commute"}</Link>
            <Link className="button buttonOnDark" href="/matches">{liveMode ? "View coworker matches" : "View demo matches"}</Link>
          </div>
          <div className="heroPromise">
            <span>Route calculated once</span>
            <span>Weekly schedule updates free</span>
            <span>Contact shared after acceptance</span>
          </div>
        </div>

        <aside className="card metricPanel">
          <div>
            <p className="eyebrow">{liveMode ? "V3 · shared pilot" : "Future impact report"}</p>
            {liveMode ? (
              <>
                <div className="metric"><strong>LIVE</strong><span>shared Supabase database</span></div>
                <div className="metric"><strong>2+</strong><span>devices can use the same data</span></div>
                <div className="metric"><strong>🔒</strong><span>phone unlocks after acceptance</span></div>
              </>
            ) : (
              <>
                <div className="metric"><strong>—</strong><span>cars avoided</span></div>
                <div className="metric"><strong>— kg</strong><span>estimated CO₂ avoided</span></div>
                <div className="metric"><strong>€—</strong><span>estimated commuting cost saved</span></div>
              </>
            )}
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {liveMode
              ? "The live pilot proves real accounts, shared profiles and requests first. Google route scoring comes next without changing the privacy model."
              : "The MVP proves matching first. These sustainability metrics remain ready for a future company-sponsored version."}
          </p>
        </aside>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">MVP flow</p>
            <h2>Route once. Coordinate whenever needed.</h2>
          </div>
        </div>
        <div className="grid3">
          <article className="card featureCard"><div className="stepNumber">1</div><h3>Add your commute</h3><p className="muted">Choose exact address, postcode, town, or a meeting point. Your precise routing origin stays private.</p></article>
          <article className="card featureCard"><div className="stepNumber">2</div><h3>Find compatible colleagues</h3><p className="muted">Weekly shifts can change freely. The Google route layer will be cached separately and only rebuilt when an origin changes.</p></article>
          <article className="card featureCard"><div className="stepNumber">3</div><h3>Connect & arrange</h3><p className="muted">Once a request is accepted, phone details unlock and coworkers can agree on exact pickup and weekly plans directly.</p></article>
        </div>
      </section>
    </main>
  );
}
