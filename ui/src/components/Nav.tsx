import { Link, useLocation } from "wouter-preact";

const NAV = [
  ["/", "Home"],
  ["/animations", "Animations"],
  ["/tests", "Tests"],
  ["/servo", "Servo"],
  ["/config", "Config"],
  ["/api", "API"],
] as const;

export function Nav() {
  const [location] = useLocation();

  return (
    <nav>
      {NAV.map(([path, label]) => (
        <Link
          key={path}
          href={path}
          className={location === path ? "active" : ""}
          aria-current={location === path ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
