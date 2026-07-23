import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import EventList from './pages/EventList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import ConfirmBooking from './pages/ConfirmBooking.jsx';
import MyBookings from './pages/MyBookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import AdminEvents from './pages/admin/AdminEvents.jsx';
import CreateEvent from './pages/admin/CreateEvent.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* shared */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* customer flow */}
        <Route path="/" element={<EventList />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route
          path="/events/:id/confirm"
          element={
            <ProtectedRoute>
              <ConfirmBooking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/:id"
          element={
            <ProtectedRoute>
              <BookingDetail />
            </ProtectedRoute>
          }
        />

        {/* admin flow */}
        <Route
          path="/admin/events"
          element={
            <ProtectedRoute adminOnly>
              <AdminEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/new"
          element={
            <ProtectedRoute adminOnly>
              <CreateEvent />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<p>Not found</p>} />
      </Routes>
    </>
  );
}