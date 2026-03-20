import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import WelcomePage from "../pages/WelcomePage";
import LoginPage from "../pages/LoginPage";
import WorkspacePlaceholderPage from "../pages/WorkspacePlaceholderPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login/:mode" element={<LoginPage />} />
      <Route path="/workspace" element={<WorkspacePlaceholderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
