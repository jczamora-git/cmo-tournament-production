import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import PublicTopNav from "./components/PublicTopNav";
import PublicHome from "./pages/PublicHome";
import UploadTeam from "./pages/UploadTeam";
import ViewSchedule from "./pages/ViewSchedule";
import ViewHistory from "./pages/ViewHistory";
import ViewBracket from "./pages/ViewBracket";
import ViewBracketPreview from "./pages/ViewBracketPreview";
import ViewStandings from "./pages/ViewStandings";
import WatchLive from "./pages/WatchLive";
import ViewTournaments from "./pages/ViewTournaments";
import ViewVideos from "./pages/ViewVideos";

function PublicPageLayout() {
  return (
    <div className="public-page-container">
      <Outlet />
    </div>
  );
}

function PublicApp() {
  return (
    <div className="admin-app">
      <PublicTopNav />
      <main className="public-shell public-page">
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route element={<PublicPageLayout />}>
            <Route path="/tournaments" element={<ViewTournaments />} />
            <Route path="/videos" element={<ViewVideos />} />
            <Route path="/upload-team" element={<UploadTeam />} />
            <Route path="/schedule" element={<ViewSchedule />} />
            <Route path="/matches" element={<Navigate to="/schedule" replace />} />
            <Route path="/history" element={<ViewHistory />} />
            <Route path="/bracket" element={<ViewBracket />} />
            <Route path="/bracket-preview" element={<ViewBracketPreview />} />
            <Route path="/standings" element={<ViewStandings />} />
            <Route path="/br-standings" element={<ViewStandings />} />
            <Route path="/live" element={<WatchLive />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export default PublicApp;
