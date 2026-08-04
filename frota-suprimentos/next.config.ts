import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Projeto irmão de ../ (KTracker CRM) tem seu próprio package-lock.json —
  // sem isso o Next tenta inferir a raiz do workspace e escolhe o repo
  // inteiro, gerando um warning a cada build.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
