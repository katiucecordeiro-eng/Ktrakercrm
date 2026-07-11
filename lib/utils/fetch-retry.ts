export type SendResult = { status: "sent" | "failed"; response: unknown };

// Uma tentativa extra em caso de falha de rede — nunca deve derrubar o
// endpoint que chamou (Meta/GA4 estão fora do nosso controle).
export async function postWithRetry(
  url: string,
  body: unknown,
  attempt = 0,
): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(typeof json === "object" ? JSON.stringify(json) : String(json));
    }
    return { status: "sent", response: json };
  } catch (error) {
    if (attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return postWithRetry(url, body, attempt + 1);
    }
    return {
      status: "failed",
      response: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}
