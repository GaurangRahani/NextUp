import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const roleColorMap = {
  customer: 'blue',
  staff: 'purple',
  admin: 'green',
};

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.info('Logged out successfully');
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary-600">
            <span>⏭</span>
            <span>NextUp</span>
          </Link>

          <Link
            to="/walk-in"
            className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
          >
            Walk-in Kiosk
          </Link>

          {isAuthenticated && (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/appointments"
                className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
              >
                Appointments
              </Link>
              <Link
                to="/book"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors font-semibold"
              >
                Book Appointment
              </Link>
              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/business/profile"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Business Profile
                  </Link>
                  <Link
                    to="/services"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Services
                  </Link>
                  <Link
                    to="/staff"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Staff
                  </Link>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                  {user?.name}
                </span>
                <Badge color={roleColorMap[user?.role] || 'gray'} className="capitalize">
                  {user?.role}
                </Badge>
              </div>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
