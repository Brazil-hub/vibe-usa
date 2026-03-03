import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import RequireAuth from "../auth/RequireAuth";
import ErrorBoundary from "../components/ErrorBoundary";

import Login from "../pages/Login";
import AuthCallback from "../auth/AuthCallback";
import HomePage from "../pages/HomePage";

const EventDetailsPage  = lazy(() => import("../pages/EventDetailsPage"));
const ProfilePage       = lazy(() => import("../pages/ProfilePage"));

const VisibilitySelect  = lazy(() => import("../pages/Create/VisibilitySelect"));
const FormatSelect      = lazy(() => import("../pages/Create/FormatSelect"));
const PaymentSelect     = lazy(() => import("../pages/Create/PaymentSelect"));
const EventCreateForm   = lazy(() => import("../pages/Create/EventCreateForm"));
const ReviewEvent       = lazy(() => import("../pages/Create/ReviewEvent"));

const OverviewPage        = lazy(() => import("../dashboard/overview/OverviewPage"));
const DashboardEventPage  = lazy(() => import("../dashboard/events/DashboardEventPage"));
const EventOverviewPage   = lazy(() => import("../dashboard/events/EventOverviewPage"));
const EventGuestsPage     = lazy(() => import("../dashboard/events/EventGuestsPage"));

const AdminReviewPage   = lazy(() => import("../pages/Admin/AdminReviewPage"));

const BuyTicketPage     = lazy(() => import("../pages/BuyTicket/BuyTicketPage"));
const MyTicketsPage     = lazy(() => import("../pages/MyTickets/MyTicketsPage"));
const TicketView        = lazy(() => import("../pages/MyTickets/TicketView"));

function PageFallback() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #2a2a2a", borderTopColor: "#ff1493", animation: "spin 0.7s linear infinite" }} />
    </div>
  );
}

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/event/:id" element={<EventDetailsPage />} />

            <Route element={<RequireAuth />}>
              <Route path="/feed" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />

              <Route path="/event/:id/buy-ticket" element={<BuyTicketPage />} />
              <Route path="/my-tickets" element={<MyTicketsPage />} />
              <Route path="/my-tickets/:ticketId" element={<TicketView />} />

              <Route path="/create/visibility" element={<VisibilitySelect />} />
              <Route path="/create/format" element={<FormatSelect />} />
              <Route path="/create/payment" element={<PaymentSelect />} />
              <Route path="/create/form" element={<EventCreateForm />} />
              <Route path="/create/review" element={<ReviewEvent />} />

              <Route path="/dashboard">
                <Route index element={<OverviewPage />} />
                <Route path="event/:id" element={<DashboardEventPage />}>
                  <Route index element={<EventOverviewPage />} />
                  <Route path="guests" element={<EventGuestsPage />} />
                </Route>
              </Route>

              <Route path="/admin/review" element={<AdminReviewPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
