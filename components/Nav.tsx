import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";

export default function Nav() {
  return (
    <header className="topbar">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brandMark">H</span>
          <span>HUBpool</span>
        </Link>

        <div className="navRight">
          <div className="navlinks">
            <Link className="navlink" href="/onboarding">
              My commute
            </Link>

            <Link className="navlink" href="/matches">
              Matches
            </Link>

            <Link className="navlink" href="/requests">
              Connections
            </Link>

            <Link className="navlink" href="/organization">
              Organization
            </Link>
          </div>

          <AuthStatus />
        </div>
      </nav>
    </header>
  );
}