import { Link } from 'react-router-dom';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import useAuth from '../hooks/useAuth';

const Dashboard = () => {
  const { user } = useAuth();
  return (
    <PageWrapper title="Dashboard">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Welcome back, {user?.name}!
            </h2>
            <p className="text-sm text-gray-500 mt-1 capitalize">
              Signed in as: <strong>{user?.role}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/walk-in">
              <Button variant="secondary">🎫 Walk-in Kiosk</Button>
            </Link>
            <Link to="/appointments">
              <Button variant="secondary">View Appointments</Button>
            </Link>
            <Link to="/book">
              <Button>+ Book Appointment</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            to="/walk-in"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-primary-500 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">🎫</span>
            <h3 className="font-bold text-gray-900 mt-2">Walk-in Kiosk</h3>
            <p className="text-xs text-gray-500 mt-1">
              Generate sequential daily walk-in tokens (Rule R4).
            </p>
          </Link>

          <Link
            to="/appointments"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-primary-500 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">📅</span>
            <h3 className="font-bold text-gray-900 mt-2">Appointments</h3>
            <p className="text-xs text-gray-500 mt-1">
              Check scheduled visits, reschedule dates, or view past records.
            </p>
          </Link>

          <Link
            to="/book"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-primary-500 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">✨</span>
            <h3 className="font-bold text-gray-900 mt-2">Book Service</h3>
            <p className="text-xs text-gray-500 mt-1">
              Choose a specialist and reserve a verified real-time slot.
            </p>
          </Link>

          {user?.role === 'admin' && (
            <Link
              to="/staff"
              className="bg-white p-5 rounded-xl border border-gray-200 hover:border-primary-500 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">👥</span>
              <h3 className="font-bold text-gray-900 mt-2">Staff & Team</h3>
              <p className="text-xs text-gray-500 mt-1">
                Manage specialists, qualifications, and service assignments.
              </p>
            </Link>
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

export default Dashboard;
