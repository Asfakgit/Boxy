import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const USERS_STORAGE_KEY = 'boxy_users_v1';
const SESSION_STORAGE_KEY = 'boxy_session_v1';

const DEFAULT_USERS = [
  {
    id: 'usr_admin',
    username: 'admin',
    password: '123',
    name: 'Admin',
    role: 'Administrator'
  },
  {
    id: 'usr_cashier',
    username: 'cashier',
    password: '123',
    name: 'Cashier Staff',
    role: 'Staff'
  }
];

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) return JSON.parse(savedSession);
    } catch {
      // Fallback
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  const login = (username, password) => {
    const trimmedUser = (username || '').trim().toLowerCase();
    const trimmedPass = (password || '').trim();

    const matched = users.find(
      u => u.username.toLowerCase() === trimmedUser && u.password === trimmedPass
    );

    if (matched) {
      const sessionData = {
        id: matched.id,
        username: matched.username,
        name: matched.name,
        role: matched.role,
        loginTime: new Date().toISOString()
      };
      setCurrentUser(sessionData);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      return { success: true, user: sessionData };
    }

    return { success: false, error: 'Incorrect username or password' };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const changeCredentials = (oldPassword, newUsername, newPassword) => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };

    const userIdx = users.findIndex(u => u.id === currentUser.id);
    if (userIdx === -1) return { success: false, error: 'User not found' };

    if (users[userIdx].password !== oldPassword.trim()) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const updatedUser = {
      ...users[userIdx],
      username: (newUsername || users[userIdx].username).trim().toLowerCase(),
      password: (newPassword || users[userIdx].password).trim()
    };

    const nextUsers = [...users];
    nextUsers[userIdx] = updatedUser;
    setUsers(nextUsers);

    const nextSession = {
      ...currentUser,
      username: updatedUser.username
    };
    setCurrentUser(nextSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        changeCredentials,
        users
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
