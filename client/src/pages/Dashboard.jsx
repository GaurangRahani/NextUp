import PageWrapper from '../components/layout/PageWrapper';
import useAuth from '../hooks/useAuth';

const Dashboard = () => {
  const { user } = useAuth();
  return (
    <PageWrapper title="Dashboard">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-600">Welcome back, <strong>{user?.name}</strong>!</p>
        <p className="text-sm text-gray-400 mt-1 capitalize">Role: {user?.role}</p>
        <p className="text-sm text-gray-400 mt-4">Dashboard content will be built in M11.</p>
      </div>
    </PageWrapper>
  );
};

export default Dashboard;
