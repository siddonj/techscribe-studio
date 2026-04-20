import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { upsertUser, getUserByGoogleId } from "@/lib/db";
import { sendNewUserNotification } from "@/lib/email";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ account, user }) {
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
        sendNewUserNotification({ name: user.name ?? null, email: user.email! }).catch(() => {});
      }
      return true;
    },

    async jwt({ token, account }) {
      if (account?.provider === "google") {
        token.googleId = account.providerAccountId;
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
