import React from "react";
import Sidebar from "./Sidebar";
import HeaderBar from "./HeaderBar";
import RightAiPanel from "./RightAiPanel";

const PAGES_WITH_AI_PANEL = ["overview", "reports"];
const ONBOARDING_PAGES = ["welcome", "createOrganization"];

export default function AppShell({
  activeNav,
  onChangeNav,
  children,
  workspaceMode,
  organization,
}) {
  const isOnboardingPage = ONBOARDING_PAGES.includes(activeNav);
  const showAiPanel =
    !isOnboardingPage && PAGES_WITH_AI_PANEL.includes(activeNav);

  if (isOnboardingPage) {
    return (
      <div className="app-shell-onboarding">
        <main className="app-content app-content-onboarding">{children}</main>
      </div>
    );
  }

  return (
    <div className={`app-shell ${showAiPanel ? "" : "no-ai-panel"}`}>
      <Sidebar
        activeNav={activeNav}
        onChange={onChangeNav}
        workspaceMode={workspaceMode}
        organization={organization}
      />

      <div className="app-main">
        <HeaderBar activeNav={activeNav} />
        <main className="app-content">{children}</main>
      </div>

      {showAiPanel ? <RightAiPanel activeNav={activeNav} /> : null}
    </div>
  );
}
