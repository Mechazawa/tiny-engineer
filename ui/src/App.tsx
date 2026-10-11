import { Link, Route, Switch, useLocation } from "wouter-preact";
import { AuthGate, RebootGate } from "./gates/gates";
import { RobotProvider, useRobot } from "./robot";
import { StatusBar, StatusProvider } from "./status/status";
import { Animations } from "./views/Animations";
import { ApiReference } from "./views/ApiReference";
import { ConfigPage } from "./config/ConfigPage";
import { Home } from "./views/Home";
import { ServoControl } from "./views/ServoControl";
import { Tests } from "./views/Tests";

const NAV = [
  ["/", "Home"],
  ["/animations", "Animations"],
  ["/tests", "Tests"],
  ["/servo", "Servo"],
  ["/config", "Config"],
  ["/api", "API"],
] as const;

function Nav() {
  const [location] = useLocation();

  return (
    <nav>
      {NAV.map(([path, label]) => (
        <Link key={path} href={path} className={location === path ? "active" : ""}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Footer() {
  const { version } = useRobot();

  return (
    <footer>
      <a href="https://github.com/jamro/tiny-engineer" target="_blank" rel="noopener">
        github.com/jamro/tiny-engineer
      </a>
      <p id="fw-version">{version ? `Firmware ${version}` : "Firmware …"}</p>
    </footer>
  );
}

function Shell() {
  const { gate, inSetup } = useRobot();

  if (gate === "booting") {
    return null;
  }

  if (gate === "auth") {
    return <AuthGate />;
  }

  if (gate === "reboot") {
    return <RebootGate />;
  }

  if (inSetup) {
    return (
      <>
        <StatusBar />
        <ConfigPage />
      </>
    );
  }

  return (
    <>
      <Nav />
      <StatusBar />
      <Switch>
        <Route path="/animations" component={Animations} />
        <Route path="/tests" component={Tests} />
        <Route path="/servo" component={ServoControl} />
        <Route path="/config" component={ConfigPage} />
        <Route path="/api" component={ApiReference} />
        <Route component={Home} />
      </Switch>
      <Footer />
    </>
  );
}

export function App() {
  return (
    <StatusProvider>
      <RobotProvider>
        <Shell />
      </RobotProvider>
    </StatusProvider>
  );
}
