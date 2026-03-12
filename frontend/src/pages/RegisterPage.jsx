import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../services/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    try {
      await authApi.register(form.name, form.email, form.password);
      navigate("/giris?registered=1");
    } catch (err) {
      setError(err.message || "Kayıt başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "name",     label: "Ad Soyad",        type: "text",     placeholder: "Ahmet Yılmaz" },
    { key: "email",    label: "E-posta",          type: "email",    placeholder: "ad@sirket.com" },
    { key: "password", label: "Şifre",            type: "password", placeholder: "••••••••" },
    { key: "confirm",  label: "Şifre (Tekrar)",   type: "password", placeholder: "••••••••" },
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center gap-3 justify-center mb-10">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 border border-gold-500/60 rotate-45" />
            <div className="absolute inset-[5px] bg-gold-500/20 rotate-45" />
          </div>
          <span className="font-display text-xl font-light tracking-[0.08em] text-slate2-200">
            AI<span className="text-gold-400">—</span>Mevzuat
          </span>
        </Link>

        <div className="bg-obsidian-800 border border-gold-700/20 rounded-2xl p-8">
          <h1 className="font-display text-2xl text-slate2-200 mb-1">Hesap Oluştur</h1>
          <p className="text-slate2-400 text-sm mb-8">Ücretsiz başlayın</p>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-slate2-400 text-xs mb-2 tracking-wider uppercase">
                  {label}
                </label>
                <input
                  type={type}
                  required
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full bg-obsidian-900 border border-gold-700/20 rounded-lg px-4 py-3 text-slate2-200 text-sm placeholder-slate2-400/40 focus:outline-none focus:border-gold-500/50 transition-colors"
                  placeholder={placeholder}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-obsidian-950 font-medium text-sm py-3 rounded-lg transition-colors duration-200"
            >
              {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
            </button>
          </form>

          <p className="mt-6 text-center text-slate2-400 text-sm">
            Zaten hesabınız var mı?{" "}
            <Link to="/giris" className="text-gold-400 hover:text-gold-300 transition-colors">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
