import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sprout, Loader2 } from "lucide-react";

const HERO =
  "https://images.pexels.com/photos/37321079/pexels-photo-37321079.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=940";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user && user.role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/hotel"} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const u = await login(email, password);
      navigate(u.role === "admin" ? "/admin" : "/hotel", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <Card className="w-full max-w-md border-border bg-card p-8 shadow-sm gg-fade-in">
          <div className="mb-8 flex items-center gap-3">
            <span className="gg-leaf flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground">
              <Sprout className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="font-serif text-xl tracking-tight">Green Groceries</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Hotel produce ordering
              </div>
            </div>
          </div>

          <h1 className="mb-2 font-serif text-3xl font-light tracking-tight">Welcome back</h1>
          <p className="mb-7 text-sm text-muted-foreground">
            Sign in to place orders or manage the daily purchase sheet.
          </p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@hotel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                className="mt-1.5"
              />
            </div>

            {error ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                data-testid="login-error"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-[#163820]"
              data-testid="login-submit-button"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground">
            New hotel? <span className="text-foreground">Contact the admin to get your login credentials.</span>
          </div>

          <div className="mt-6 rounded-md border border-dashed border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium uppercase tracking-[0.14em] text-foreground">Demo admin</div>
            admin@greengroceries.com · admin123
          </div>
        </Card>
      </div>

      {/* Right: hero */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={HERO}
          alt="Fresh vegetables at a local market"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1F4A2C]/60 mix-blend-multiply" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <div className="max-w-md">
            <div className="mb-3 text-[11px] uppercase tracking-[0.22em] opacity-80">
              Farm to hotel kitchen
            </div>
            <h2 className="font-serif text-4xl font-light leading-tight">
              One platform. Many hotels. <br /> One purchase sheet.
            </h2>
            <p className="mt-4 text-sm opacity-85">
              Hotels place orders; we aggregate quantities across every kitchen so your
              produce buyer walks into the mandi with a single, accurate list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
