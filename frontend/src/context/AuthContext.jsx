import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

const ROLE_CLAIM_URI = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
const EMAIL_CLAIM_URI = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";
const NAME_CLAIM_URI = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";

function decodeJwt(token) {
  const payloadBase64 = token?.split(".")?.[1];
  if (!payloadBase64) throw new Error("Invalid token payload");

  const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(normalized));
}

function normalizeRole(value) {
  if (!value) return "Free";
  if (Array.isArray(value)) return normalizeRole(value[0]);
  const raw = String(value).trim();
  const key = raw.toLowerCase();

  if (key === "99" || key === "admin") return "Admin";
  if (key === "2" || key === "enterprise") return "Enterprise";
  if (key === "1" || key === "professional") return "Professional";
  if (key === "0" || key === "free") return "Free";

  return raw;
}

function mapPayloadToUser(payload) {
  const role = normalizeRole(payload?.role || payload?.[ROLE_CLAIM_URI] || payload?.Role);
  const email = payload?.email || payload?.[EMAIL_CLAIM_URI] || payload?.sub || "";
  const name = payload?.name || payload?.[NAME_CLAIM_URI] || email || "";

  return { email, name, role };
}

function mapAuthResponseToUser(data, fallbackPayload) {
  const user = data?.user || data?.User;
  if (user) {
    return {
      email: user.email || user.Email || fallbackPayload?.email || "",
      name: user.fullName || user.FullName || fallbackPayload?.name || "",
      role: normalizeRole(
        user.role ||
        user.Role ||
        fallbackPayload?.role ||
        fallbackPayload?.[ROLE_CLAIM_URI] ||
        fallbackPayload?.Role
      ),
    };
  }

  if (fallbackPayload) {
    return mapPayloadToUser(fallbackPayload);
  }

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authApi.isLoggedIn()) {
      try {
        const token = localStorage.getItem("access_token");
        const payload = decodeJwt(token);
        setUser(mapPayloadToUser(payload));
      } catch {
        authApi.logout();
      }
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    const accessToken = data?.accessToken || data?.AccessToken;

    let payload = null;
    if (accessToken) {
      payload = decodeJwt(accessToken);
    }

    const resolvedUser = mapAuthResponseToUser(data, payload);
    if (!resolvedUser) {
      throw new Error("Kullanici bilgisi okunamadi.");
    }

    setUser(resolvedUser);
    return { ...data, user: resolvedUser };
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isLoggedIn: !!user,
        isAdmin: user?.role === "Admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
