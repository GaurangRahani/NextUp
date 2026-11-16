import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import PageWrapper from '../components/layout/PageWrapper';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'customer',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await register(formData);
      if (result.success) {
        toast.success(`Account created! Welcome, ${result.user.name}`);
        navigate('/dashboard');
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✨</div>
          <h1 className="text-2xl font-bold text-gray-900">Create an Account</h1>
          <p className="text-sm text-gray-500 mt-1">Get started with NextUp today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            type="text"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            autoComplete="name"
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            placeholder="jane@example.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="email"
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="At least 6 characters"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="new-password"
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="role" className="text-sm font-medium text-gray-700">
              Account Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="customer">Customer (Book & track appointments)</option>
              <option value="staff">Staff Member (Manage assigned queues)</option>
              <option value="admin">Business Admin (Full management)</option>
            </select>
          </div>

          <Button
            type="submit"
            className="w-full mt-2"
            loading={loading}
          >
            Create Account
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign In
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
};

export default RegisterPage;
