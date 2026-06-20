import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sprout, Loader2 } from "lucide-react";

const HERO =
  "https://images.pexels.com/photos/12519455/pexels-photo-12519455.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=940";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    hotel_name: "", name: "", email: "", phone: "", address: "", password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user && user.role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/hotel"} replace />;
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await register(form);
      navigate("/hotel", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Wholesale produce crates" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#1F4A2C]/55 mix-blend-multiply" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <div className="max-w-md">
            <div className="mb-3 text-[11px] uppercase tracking-[0.22em] opacity-80">Join the network</div>
            <h2 className="font-serif text-4xl font-light leading-tight">
              Register your hotel <br /> in under a minute.
            </h2>
            <p className="mt-4 text-sm opacity-85">
              Place your daily produce order before 10 PM. The combined purchase sheet
              reaches our buyer first thing every morning.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <Card className="w-full max-w-md border-border bg-card p-8 shadow-sm gg-fade-in">
          <div className="mb-7 flex items-center gap-3">
            <span className="gg-leaf flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground">
              <Sprout className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="font-serif text-xl tracking-tight">Create a hotel account</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Free, instant access</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
            <div>
              <Label htmlFor="hotel_name">Hotel name</Label>
              <Input id="hotel_name" required value={form.hotel_name} onChange={set("hotel_name")} data-testid="register-hotel-name-input" className="mt-1.5" placeholder="Grand Plaza" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Contact name</Label>
                <Input id="name" required value={form.name} onChange={set("name")} data-testid="register-name-input" className="mt-1.5" placeholder="Mr. Sharma" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={set("phone")} data-testid="register-phone-input" className="mt-1.5" placeholder="+91…" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={set("email")} data-testid="register-email-input" className="mt-1.5" placeholder="orders@hotel.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={form.password} onChange={set("password")} data-testid="register-password-input" className="mt-1.5" placeholder="At least 6 characters" />
            </div>
            <div>
              <Label htmlFor="address">Address (optional)</Label>
              <Textarea id="address" rows={2} value={form.address} onChange={set("address")} data-testid="register-address-input" className="mt-1.5" placeholder="Street, City" />
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="register-error">
                {error}
              </div>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="register-submit-button">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline" data-testid="goto-login-link">
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
