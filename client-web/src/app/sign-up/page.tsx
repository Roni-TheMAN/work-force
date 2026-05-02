import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { checkSignUpEmailExists } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

function getSignUpErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already exists")) {
      return "An account with this email already exists. Sign in instead or use a different email.";
    }

    return error.message;
  }

  return "Unable to create your account.";
}

export function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);

    try {
      const emailExists = await checkSignUpEmailExists(normalizedEmail);

      if (emailExists) {
        setErrorMessage("An account with this email already exists. Sign in instead or use a different email.");
        return;
      }

      const session = await signUp(normalizedEmail, password, fullName.trim(), phone.trim());

      if (session) {
        navigate("/quick-dash", { replace: true });
        return;
      }

      setSuccessMessage("Account created. Confirm your email in Supabase, then sign in.");
    } catch (error) {
      setErrorMessage(getSignUpErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your Workforce account"
      description="Create the Supabase-authenticated client account first. The backend will sync your user record on the first signed-in request."
      footer={
        <p className="text-sm text-muted-foreground">
          Already have access?{" "}
          <Link to="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="sign-up-name">Full name</Label>
          <Input
            id="sign-up-name"
            placeholder="Jordan Lee"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sign-up-email">Work email</Label>
          <Input
            id="sign-up-email"
            type="email"
            placeholder="jordan@company.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sign-up-phone">Phone number</Label>
          <Input
            id="sign-up-phone"
            type="tel"
            placeholder="(555) 123-4567"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sign-up-password">Password</Label>
            <Input
              id="sign-up-password"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sign-up-confirm-password">Confirm password</Label>
            <Input
              id="sign-up-confirm-password"
              type="password"
              placeholder="Repeat password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <Separator />
      <p className="text-sm text-muted-foreground">
        If email confirmation is enabled in Supabase, the account may need confirmation before the first sign-in.
      </p>
    </AuthLayout>
  );
}
