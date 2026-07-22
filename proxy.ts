import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Protege tudo, exceto: rotas de API (públicas por padrão, cada uma
    // valida seu próprio segredo), assets estáticos e arquivos internos
    // do Next.js.
    "/((?!api|_next/static|_next/image|favicon.ico|track.js).*)",
  ],
};
