"use client";

import { ImageOff, Camera } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import type { InstagramPost } from "@/lib/instagram/api-client";

function NotConfiguredCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de posts orgânicos (Instagram)</CardTitle>
        <CardDescription>Instagram Business Account não conectado nesta oferta.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Camera className="size-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            Para ver os posts orgânicos aqui, cadastre em Configurações → Ofertas → Editar: o{" "}
            <strong>Instagram Business Account ID</strong> (conta comercial do Instagram vinculada à
            Página do Facebook) e um <strong>token do Instagram Graph API</strong> com permissão{" "}
            <code className="font-mono-nums">instagram_basic</code> +{" "}
            <code className="font-mono-nums">instagram_insights</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ error }: { error: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de posts orgânicos (Instagram)</CardTitle>
        <CardDescription>Não foi possível buscar os posts.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function InstagramPostsSection({
  configured,
  posts,
  error,
}: {
  configured: boolean;
  posts: InstagramPost[];
  error?: string;
}) {
  if (!configured) return <NotConfiguredCard />;
  if (error) return <ErrorCard error={error} />;

  const withEngagement = posts.filter((p) => p.engagementRate !== null);
  const averageEngagement =
    withEngagement.length > 0
      ? withEngagement.reduce((sum, p) => sum + (p.engagementRate ?? 0), 0) / withEngagement.length
      : 0;

  const ranked = [...posts].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0));
  const timeline = [...posts]
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
    .map((p) => ({ label: formatDate(p.timestamp), engagement: p.engagementRate ?? 0 }));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Engajamento dos últimos {posts.length} posts</CardTitle>
          <CardDescription>Taxa de engajamento = (curtidas + comentários + salvamentos) ÷ alcance.</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem posts encontrados.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
                          <p className="mb-1 font-medium text-foreground">{label}</p>
                          <p className="font-mono-nums text-accent">
                            Engajamento: {formatPercent(payload[0]!.value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="engagement" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking por engajamento</CardTitle>
          <CardDescription>
            Badge &quot;Potencial para anunciar&quot;: engajamento acima da média dos posts listados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem posts encontrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Curtidas</TableHead>
                  <TableHead>Comentários</TableHead>
                  <TableHead>Salvamentos</TableHead>
                  <TableHead>Engajamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {post.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- thumbnail externo do Instagram, domínio dinâmico
                          <img src={post.thumbnailUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded bg-surface-hover text-muted-foreground">
                            <ImageOff className="size-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-sm text-foreground">
                            {post.caption || "(sem legenda)"}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(post.timestamp)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono-nums">{formatNumber(post.reach)}</TableCell>
                    <TableCell className="font-mono-nums">{formatNumber(post.likeCount)}</TableCell>
                    <TableCell className="font-mono-nums">{formatNumber(post.commentsCount)}</TableCell>
                    <TableCell className="font-mono-nums">{formatNumber(post.saved)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-nums">{formatPercent(post.engagementRate)}</span>
                        {post.engagementRate !== null && post.engagementRate > averageEngagement ? (
                          <Badge>💡 Potencial para anunciar</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
