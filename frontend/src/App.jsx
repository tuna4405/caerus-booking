import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar.jsx';
import EventList from './pages/EventList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CreateEvent from './pages/admin/CreateEvent.jsx';
import UploadBanner from './pages/admin/UploadBanner.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<EventList />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/events/new" element={<CreateEvent />} />
        <Route path="/admin/events/:id/banner" element={<UploadBanner />} />
      </Routes>
    </>
  );
}
