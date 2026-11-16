import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../LoginPage';
import { AuthContext } from '../../context/AuthContext';

const renderWithContext = (loginFn = vi.fn()) => {
  const mockAuthContext = {
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    login: loginFn,
    logout: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={mockAuthContext}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('LoginPage', () => {
  it('renders login form with email, password inputs and submit button', () => {
    renderWithContext();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitted with empty fields', async () => {
    renderWithContext();

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('submits form with user credentials when valid', async () => {
    const mockLogin = vi.fn().mockResolvedValue({
      success: true,
      user: { name: 'Jane Doe', role: 'customer' },
    });

    renderWithContext(mockLogin);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'password123');
    });
  });
});
