import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">
            Frota <span className="text-accent">x Suprimentos</span>
          </CardTitle>
          <CardDescription>Entre com sua conta para acessar o painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
