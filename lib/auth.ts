import 'server-only';
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from "@/../data/db";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'mock',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock',
    }),
    CredentialsProvider({
      name: "Demo Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "rank_chaser_07" }
      },
      async authorize(credentials) {
        if (!credentials?.username) return null;
        let user = await Database.getUserByName(credentials.username);
        if (!user) {
          user = await Database.createUser({ name: credentials.username });
        }
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        let dbUser = await Database.getUserByEmail(user.email);
        if (!dbUser) {
          dbUser = await Database.createUser({
            name: user.name || user.email.split('@')[0],
            email: user.email,
            image: user.image
          });
        }
        // Attach db id
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      if (trigger === "update" && session?.subjects) {
        token.subjects = session.subjects;
      }
      // Get latest subjects from DB
      if (token.id) {
        const dbUser = await Database.getUserById(token.id);
        if (dbUser) {
          token.subjects = dbUser.subjects;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.subjects = token.subjects || [];
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback_secret_for_dev_only'
};

const { handlers, auth: nextAuthAuth } = NextAuth(authOptions);

async function getSupabaseUserFromCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Some server contexts are read-only for cookies. That's fine for read-path auth.
            }
          }
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function ensureDbUserFromIdentity(identity) {
  if (!identity?.email) return null;

  let dbUser = await Database.getUserByEmail(identity.email);
  if (!dbUser) {
    dbUser = await Database.createUser({
      id: identity.id,
      name: identity.name || identity.email.split('@')[0],
      email: identity.email,
      image: identity.image || null,
      subjects: [],
    });
  }
  return dbUser;
}

export async function auth() {
  const nextAuthSession = await nextAuthAuth();
  if (nextAuthSession?.user?.id) {
    return nextAuthSession;
  }

  const supabaseUser = await getSupabaseUserFromCookies();
  if (!supabaseUser?.email) return null;

  const dbUser = await ensureDbUserFromIdentity({
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
    email: supabaseUser.email,
    image: supabaseUser.user_metadata?.avatar_url || null,
  });
  if (!dbUser) return null;

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
      subjects: dbUser.subjects || [],
      supabaseId: supabaseUser.id,
    },
  };
}

export { handlers };
