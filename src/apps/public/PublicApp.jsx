import { Routes, Route, Navigate } from "react-router-dom";
import PublicTopNav from "./components/PublicTopNav";
import PublicHome from "./pages/PublicHome";
import UploadTeam from "./pages/UploadTeam";
import ViewSchedule from "./pages/ViewSchedule";
import ViewHistory from "./pages/ViewHistory";
import ViewBracket from "./pages/ViewBracket";
import WatchLive from "./pages/WatchLive";
import ViewTournaments from "./pages/ViewTournaments";
import ViewVideos from "./pages/ViewVideos";

function PublicApp() {
  return (
    <div className="admin-app">
      <PublicTopNav />
      <main className="admin-shell">
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/tournaments" element={<ViewTournaments />} />
          <Route path="/videos" element={<ViewVideos />} />
          <Route path="/upload-team" element={<UploadTeam />} />
          <Route path="/schedule" element={<ViewSchedule />} />
          <Route path="/matches" element={<Navigate to="/schedule" replace />} />
          <Route path="/history" element={<ViewHistory />} />
          <Route path="/bracket" element={<ViewBracket />} />
          <Route path="/live" element={<WatchLive />} />
        </Routes>
      </main>
    </div>
  );
}

export default PublicApp;
