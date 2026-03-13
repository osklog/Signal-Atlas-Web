import Link from "next/link";

import { NavLink } from "@/components/nav-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="brand-block">
        <Link href="/" className="brand-mark">
          Signal Atlas
        </Link>
        <p className="brand-copy">
          Private world-news discovery, clustered into editorial signals.
        </p>
      </div>

      <nav className="site-nav" aria-label="Primary navigation">
        <NavLink href="/" label="Radar" />
        <NavLink href="/overlooked" label="Overlooked" />
        <NavLink href="/saved" label="Saved" />
      </nav>
    </header>
  );
}
