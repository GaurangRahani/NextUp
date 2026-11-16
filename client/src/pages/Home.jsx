import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import useAuth from '../hooks/useAuth';

const Home = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <span className="text-6xl mb-4">⏭</span>
      <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to NextUp</h1>
      <p className="text-lg text-gray-500 max-w-xl mb-8">
        Smart appointment scheduling and queue management for local businesses.
        Book your slot, track your position, and skip the wait.
      </p>
      {isAuthenticated ? (
        <Link to="/dashboard">
          <Button size="lg">Go to Dashboard</Button>
        </Link>
      ) : (
        <div className="flex gap-3">
          <Link to="/register"><Button size="lg">Get Started</Button></Link>
          <Link to="/login"><Button variant="secondary" size="lg">Sign In</Button></Link>
        </div>
      )}
    </div>
  );
};

export default Home;
