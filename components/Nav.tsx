import Link from "next/link";

export default function Nav() {
  return (
    <header className="topbar">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brandMark">H</span>
          <span>HUBpool</span>
        </Link>
        <div className="navlinks">
          <Link className="navlink" href="/onboarding">My commute</Link>
          <Link className="navlink" href="/matches">Matches</Link>
          <Link className="navlink" href="/requests">Connections</Link>
        </div>
      </nav>
    </header>
  );
}
