import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema) as any,
  });

  // Redirect if already logged in
  useState(() => {
    if (user) {
      setLocation("/");
    }
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    const success = await login(data.username, data.password);
    setIsSubmitting(false);
    if (success) {
      setLocation("/");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200 rounded-2xl overflow-hidden">
        <CardHeader className="space-y-1 bg-[#0f172a] text-white p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to your administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                className="h-11"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-sm text-red-500 font-medium">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                className="h-11"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium text-lg mt-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t border-slate-100 p-6">
          <p className="text-center w-full text-sm text-slate-500">
            Forgot password? Contact system administrator.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
