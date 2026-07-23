import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { signInWithUsername, signUpWithUsername } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DispelLogo } from "@/components/DispelLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — DISPEL OPERAÇÃO" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app" });
    });
  }, [nav]);

  const submit = async (mode: "login" | "signup") => {
    if (!username || !password) return toast.error("Preencha usuário e senha.");
    setLoading(true);
    try {
      const { error } =
        mode === "login"
          ? await signInWithUsername(username, password)
          : await signUpWithUsername(username, password, displayName);
      if (error) throw error;
      toast.success(mode === "login" ? "Bem-vindo." : "Conta criada.");
      nav({ to: "/app" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <DispelLogo className="h-24 w-auto mx-auto" />
          <p className="mt-2 text-primary tracking-[0.3em] text-xs font-display">OPERAÇÃO</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Acesso à operação</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="space-y-3 mt-4">
                <div>
                  <Label>Usuário</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button className="w-full" disabled={loading} onClick={() => submit("login")}>
                  Entrar
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="space-y-3 mt-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como te chamamos"
                  />
                </div>
                <div>
                  <Label>Usuário</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <Button className="w-full" disabled={loading} onClick={() => submit("signup")}>
                  Criar conta
                </Button>
                <p className="text-xs text-muted-foreground">
                  O primeiro usuário criado precisa ser promovido a gestor manualmente no backend.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
