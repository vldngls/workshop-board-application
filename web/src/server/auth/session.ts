import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { decryptToken } from "@/utils/tokenCrypto";
import type { Role } from "@/types/auth";

interface SessionPayload {
  sub: string;
  email?: string;
  role?: Role | string;
  name?: string;
  [key: string]: unknown;
}

export interface Session {
  token: string;
  userId: string;
  email?: string;
  role: Role;
  name?: string;
  rawPayload: SessionPayload;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const encToken = cookieStore.get("token")?.value;

  if (!encToken) {
    return null;
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("[auth] JWT_SECRET missing – cannot verify session");
    return null;
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const raw = await decryptToken(encToken);
    const { payload } = await jwtVerify(raw, secret);

    const sessionPayload = payload as SessionPayload;
    const role = (sessionPayload.role as Role | undefined) ?? "job-controller";

    return {
      token: raw,
      userId: sessionPayload.sub,
      email: sessionPayload.email,
      role,
      name: sessionPayload.name,
      rawPayload: sessionPayload,
    };
  } catch (error) {
    console.warn("[auth] Failed to verify session token:", error);
    return null;
  }
}


