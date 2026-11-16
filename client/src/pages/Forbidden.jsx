import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const Forbidden = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <h1 className="text-8xl font-bold text-red-200">403</h1>
    <h2 className="text-2xl font-semibold text-gray-700 mt-4">Access Denied</h2>
    <p className="text-gray-500 mt-2 mb-6">You don't have permission to view this page.</p>
    <Link to="/"><Button>Go Home</Button></Link>
  </div>
);

export default Forbidden;
