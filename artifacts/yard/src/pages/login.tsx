import { useState } from "react";
import { useLocation } from "wouter";
import { useYardLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useYardLogin({
    mutation: {
      onSuccess: (user) => {
        login(user);
        setLocation("/");
      },
      onError: () => {
        toast({ title: "Invalid credentials", description: "Check your username and password.", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[hsl(221,83%,53%)] mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-4.724A1 1 0 013 14.382V5a1 1 0 011-1h7.586a1 1 0 01.707.293l7 7a1 1 0 010 1.414l-5.293 5.293a1 1 0 01-1.414 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Yard Manager</h1>
          <p className="mt-1 text-sm text-[hsl(215,20%,65%)]">IGMMA DMS — Vehicle Yard Operations</p>
        </div>

        <div className="bg-[hsl(222,47%,14%)] border border-[hsl(217,32%,20%)] rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                id="username"
                data-testid="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,25%)] rounded text-white text-sm placeholder-[hsl(215,20%,40%)] focus:outline-none focus:border-[hsl(221,83%,53%)] focus:ring-1 focus:ring-[hsl(221,83%,53%)]"
                placeholder="yard.manager"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                id="password"
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,25%)] rounded text-white text-sm placeholder-[hsl(215,20%,40%)] focus:outline-none focus:border-[hsl(221,83%,53%)] focus:ring-1 focus:ring-[hsl(221,83%,53%)]"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              data-testid="button-login"
              disabled={loginMutation.isPending || !username || !password}
              className="w-full mt-2 py-2 px-4 bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,47%)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
