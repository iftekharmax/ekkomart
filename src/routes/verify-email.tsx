import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Carrot, Mail } from "lucide-react";

type Search = { email?: string };

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify your email — Tokyohalal" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = useSearch({ from: "/verify-email" }) as Search;
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No email to verify.</p>
          <Link to="/auth" className="text-primary underline">Go to sign up</Link>
        </div>
      </div>
    );
  }

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account verified — welcome!");
    const to = await getPostLoginPath();
    navigate({ to });
  };

  const onResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) return toast.error(error.message);
    toast.success("A new code has been sent");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2 text-2xl font-bold">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Carrot className="h-5 w-5" />
          </span>
          Tokyohalal
        </Link>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-center mb-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </span>
          </div>
          <h1 className="text-center text-xl font-semibold">Check your email</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>

          <form onSubmit={onVerify} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-[0.5em] font-semibold"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? "Verifying…" : "Verify & create account"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" onClick={onResend} disabled={resending} className="hover:text-foreground disabled:opacity-50">
              {resending ? "Resending…" : "Resend code"}
            </button>
            <Link to="/auth" className="hover:text-foreground">Use a different email</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
