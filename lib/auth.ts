import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { upsertUser, getUserByGoogleId, getDb } from "@/lib/db";
import { sendNewUserNotification } from "@/lib/email";

function upsertDevUser() {
  getDb()
    .prepare(
      `INSERT INTO users (google_id, email, name, avatar, status, role)
       VALUES ('dev-local', 'dev@local.dev', 'Dev User', NULL, 'approved', 'admin')
       ON CONFLICT(google_id) DO UPDATE SET status = 'approved', role = 'admin'`
    )
    .run();
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    ...(process.env.NODE_ENV === "development"
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "Dev Login",
            credentials: {},
            async authorize() {
              upsertDevUser();
              return { id: "dev-local", email: "dev@local.dev", name: "Dev User" };
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.type === "credentials") return true;
      if (account?.provider !== "google") return false;
      const isNew = !getUserByGoogleId(account.providerAccountId);
      upsertUser({
        google_id: account.providerAccountId,
        email: user.email!,
        name: user.name ?? null,
        avatar: user.image ?? null,
      });
      if (isNew) {
        // Fire-and-forget — don't block sign-in if email fails
        sendNewUserNotification({ name: user.name ?? null, email: user.email! }).catch((err) => {
          console.error("New user notification email failed:", err);
        });
      }
      return true;
    },

    async jwt({ token, account, user }) {
      if (account?.provider === "google") {
        token.googleId = account.providerAccountId;
      }
      if (account?.type === "credentials" && user?.id) {
        token.googleId = user.id;
      }
      // Re-fetch status on every JWT evaluation so approval takes effect on
      // the next session read without requiring a sign-out/sign-in cycle.
      if (token.googleId) {
        const dbUser = getUserByGoogleId(token.googleId as string);
        if (dbUser) {
          token.userId = dbUser.id;
          token.status = dbUser.status;
          token.role = dbUser.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).status = token.status;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
};

/**
 * Call at the top of any API route handler that requires an approved user.
 * Returns { error: NextResponse } if the request should be rejected,
 * or { session } if the user is authenticated and approved.
 */
export async function requireApprovedSession(): Promise<
  | { error: NextResponse }
  | { session: NonNullable<Awaited<ReturnType<typeof getServerSession>>> }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const status = (session.user as Record<string, unknown>).status;
  if (status !== "approved") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session: session as NonNullable<typeof session> };
}
