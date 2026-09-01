import Link from "next/link";

export default function HomePage() {
  return (
    <main className="stack">
      <section className="card hero">
        <div className="heroContent">
          <p className="eyebrow">
            SMARTER EMPLOYEE COMMUTING
          </p>

          <h1>
            Share the commute.
            <br />
            Reduce the impact.
          </h1>

          <p className="heroText">
            HUBpool connects coworkers travelling
            to the same workplace and identifies
            practical opportunities to share the
            journey.
          </p>

          <div className="actions">
            <Link
              className="button"
              href="/onboarding"
            >
              Set up my commute
            </Link>

            <Link
              className="button buttonSecondary"
              href="/matches"
            >
              Find coworkers
            </Link>
          </div>
        </div>

        <div className="heroMetricCard">
          <p className="miniLabel">
            BUILT AROUND ONE SIMPLE IDEA
          </p>

          <strong>
            Fewer cars.
          </strong>

          <span>
            Same destination.
          </span>

          <p>
            Employees travelling towards the same
            HUB can coordinate journeys without
            exposing their private home address.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">
              HOW IT WORKS
            </p>

            <h2>
              Route compatibility first.
            </h2>
          </div>
        </div>

        <div className="featureGrid">
          <article className="featureCard">
            <span className="sectionIcon">
              01
            </span>

            <h3>
              Add your commute
            </h3>

            <p>
              Choose an exact address, postcode,
              town or meeting point depending on
              the level of privacy you prefer.
            </p>
          </article>

          <article className="featureCard">
            <span className="sectionIcon">
              02
            </span>

            <h3>
              Find compatible coworkers
            </h3>

            <p>
              HUBpool compares coworkers travelling
              to the same workplace and combines
              geographic and weekly schedule
              compatibility.
            </p>
          </article>

          <article className="featureCard">
            <span className="sectionIcon">
              03
            </span>

            <h3>
              Connect privately
            </h3>

            <p>
              Send a carpool request. Contact
              details remain private until both
              coworkers agree to connect.
            </p>
          </article>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">
              DESIGNED FOR WORKPLACES
            </p>

            <h2>
              One platform. Many organizations.
            </h2>
          </div>
        </div>

        <div className="featureGrid">
          <article className="featureCard">
            <h3>
              Employees
            </h3>

            <p>
              Reduce commuting costs while finding
              coworkers who already travel along a
              compatible route.
            </p>
          </article>

          <article className="featureCard">
            <h3>
              Teams
            </h3>

            <p>
              Turn everyday commuting into another
              opportunity for colleagues to connect
              and help each other.
            </p>
          </article>

          <article className="featureCard">
            <h3>
              Organizations
            </h3>

            <p>
              Encourage shared mobility and build
              measurable insight into estimated
              commuting emissions avoided.
            </p>
          </article>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">
              PRIVACY BY DESIGN
            </p>

            <h2>
              Your commute data is not a company map
              of employee homes.
            </h2>
          </div>
        </div>

        <div className="featureGrid">
          <article className="featureCard">
            <h3>
              Private origin
            </h3>

            <p>
              Exact routing information can remain
              private while coworkers see only a
              general public area.
            </p>
          </article>

          <article className="featureCard">
            <h3>
              Protected contact
            </h3>

            <p>
              Phone numbers are hidden from the
              coworker directory and revealed only
              after an accepted connection.
            </p>
          </article>

          <article className="featureCard">
            <h3>
              Isolated workplaces
            </h3>

            <p>
              Employees only discover coworkers
              assigned to their own organization
              and HUB.
            </p>
          </article>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">
              COMING NEXT
            </p>

            <h2>
              Sustainability insights.
            </h2>
          </div>
        </div>

        <div className="statsGrid">
          <div className="statCard">
            <strong>🚗</strong>
            <span>Shared journeys</span>
          </div>

          <div className="statCard">
            <strong>↓</strong>
            <span>Individual trips avoided</span>
          </div>

          <div className="statCard">
            <strong>🌱</strong>
            <span>Estimated CO₂e avoided</span>
          </div>

          <div className="statCard">
            <strong>€</strong>
            <span>Estimated commuting savings</span>
          </div>
        </div>

        <p className="muted">
          Organizational reporting will use
          aggregated commuting activity rather than
          exposing individual employee locations.
        </p>
      </section>
    </main>
  );
}