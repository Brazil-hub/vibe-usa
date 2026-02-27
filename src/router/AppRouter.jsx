import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import RequireAuth from "../auth/RequireAuth";
import ErrorBoundary from "../components/ErrorBoundary";

import Login from "../pages/Login";
import AuthCallback from "../auth/AuthCallback";
import HomePage from "../pages/HomePage";
import EventDetailsPage from "../pages/EventDetailsPage";
import ProfilePage from "../pages/ProfilePage";

import VisibilitySelect from "../pages/Create/VisibilitySelect";
import FormatSelect from "../pages/Create/FormatSelect";
import PaymentSelect from "../pages/Create/PaymentSelect";
import EventCreateForm from "../pages/Create/EventCreateForm";
import ReviewEvent from "../pages/Create/ReviewEvent";

import OverviewPage from "../dashboard/overview/OverviewPage";
import DashboardEventPage from "../dashboard/events/DashboardEventPage";
import EventOverviewPage from "../dashboard/events/EventOverviewPage";
import EventGuestsPage from "../dashboard/events/EventGuestsPage";

import AdminReviewPage from "../pages/Admin/AdminReviewPage";

import BuyTicketPage from "../pages/BuyTicket/BuyTicketPage";
import MyTicketsPage from "../pages/MyTickets/MyTicketsPage";
import TicketView from "../pages/MyTickets/TicketView";

export default function AppRouter() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route element={<AppLayout />}>
        {/* PUBLICAS */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* EVENTO (publica por rota; a página pode exigir login internamente se for privado) */}
        <Route path="/event/:id" element={<EventDetailsPage />} />

        {/* PRIVADAS */}
        <Route element={<RequireAuth />}>
          <Route path="/feed" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* INGRESSOS */}
          <Route path="/event/:id/buy-ticket" element={<BuyTicketPage />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/my-tickets/:ticketId" element={<TicketView />} />

          {/* CREATE FLOW */}
          <Route path="/create/visibility" element={<VisibilitySelect />} />
          <Route path="/create/format" element={<FormatSelect />} />
          <Route path="/create/payment" element={<PaymentSelect />} />
          <Route path="/create/form" element={<EventCreateForm />} />
          <Route path="/create/review" element={<ReviewEvent />} />

          {/* DASHBOARD */}
          <Route path="/dashboard">
            <Route index element={<OverviewPage />} />
            <Route path="event/:id" element={<DashboardEventPage />}>
              <Route index element={<EventOverviewPage />} />
              <Route path="guests" element={<EventGuestsPage />} />
            </Route>
          </Route>

          {/* ADMIN */}
          <Route path="/admin/review" element={<AdminReviewPage />} />
        </Route>

        {/* FALLBACK */}
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}
