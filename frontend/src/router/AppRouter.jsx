import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import TestOpsLandingPage from "../pages/TestOpsLandingPage";
import WelcomePage from "../pages/WelcomePage";
import LoginPage from "../pages/LoginPage";

import ProjectOnboardingPage from "../pages/ProjectOnboardingPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<TestOpsLandingPage />} />
      <Route path="/onboarding" element={<WelcomePage />} />
      <Route path="/login/:mode" element={<LoginPage />} />

      <Route path="/workspace" element={<ProjectOnboardingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
