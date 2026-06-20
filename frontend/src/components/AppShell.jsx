import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sprout, LogOut } from "lucide-react";

export function AppShell({ children, nav }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" data-testid="brand-link">
            <span className="gg-leaf flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground">
              <Sprout className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="leading-tight">
              <div className="font-serif text-lg tracking-tight">Green Groceries</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Hotel Produce Ordering
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" data-testid="primary-nav">
            {nav?.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-testid={`nav-${item.key}`}
                  className={
                    "rounded-md px-3 py-1.5 text-sm transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium" data-testid="user-name">
                {user?.hotel_name || user?.name}
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {user?.role}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              data-testid="logout-button"
              className="border-border"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>

        {nav?.length ? (
          <div className="border-t border-border md:hidden">
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
              {nav.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-testid={`nav-mobile-${item.key}`}
                    className={
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm " +
                      (active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="gg-fade-in">{children}</div>
      </main>
    </div>
  );
}
