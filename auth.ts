import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";

// 1. Garantia estrita de uso obrigatório de process.env.AUTH_SECRET
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.trim().length < 16) {
  throw new Error(
    "[DevSecOps] ERRO CRÍTICO DE SEGURANÇA: A variável de ambiente AUTH_SECRET é obrigatória e deve possuir pelo menos 16 caracteres."
  );
}

// 2. Erro padronizado para evitar enumeração de usuários (User Enumeration)
class InvalidCredentialsError extends CredentialsSignin {
  code = "Credenciais inválidas";
  message = "Credenciais inválidas";
}

// 3. Schema estrito com Zod para validação de entrada antes do processamento
export const LoginCredentialsSchema = z.object({
  email: z
    .string({ required_error: "Credenciais inválidas" })
    .trim()
    .toLowerCase()
    .email("Credenciais inválidas")
    .max(254, "Credenciais inválidas"),
  password: z
    .string({ required_error: "Credenciais inválidas" })
    .min(8, "Credenciais inválidas")
    .max(128, "Credenciais inválidas"),
});

// 4. Função de busca de usuário segura (sem senhas em texto puro)
async function getUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
} | null> {
  const adminEmail = (process.env.AUTH_ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPasswordHash = (process.env.AUTH_ADMIN_PASSWORD_HASH || "").trim();

  if (adminEmail && adminPasswordHash && email === adminEmail) {
    return {
      id: "admin-1",
      email: adminEmail,
      name: "Administrador NFT Logistics",
      passwordHash: adminPasswordHash,
      role: "admin",
    };
  }

  return null;
}

const isProduction = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Obrigatório para compatibilidade com proxies reversos e deploy na Vercel
  trustHost: true,
  secret: process.env.AUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },

  // Configuração explícita de cookies seguros para produção
  cookies: {
    sessionToken: {
      name: isProduction
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction ? true : false,
      },
    },
    callbackUrl: {
      name: isProduction
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction ? true : false,
      },
    },
    csrfToken: {
      name: isProduction ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction ? true : false,
      },
    },
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        // 1. Validação estrita de schema com Zod antes de qualquer processamento
        const parsed = LoginCredentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new InvalidCredentialsError();
        }

        const { email, password } = parsed.data;

        // 2. Busca o usuário e realiza comparação em tempo constante com bcrypt
        const user = await getUserByEmail(email);

        // Hash dummy para mitigar ataques de timing caso o e-mail não exista
        const dummyHash =
          "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4h/9S1G5C2";
        const targetHash = user ? user.passwordHash : dummyHash;

        const isPasswordValid = await bcrypt.compare(password, targetHash);

        if (!user || !isPasswordValid) {
          // Mensagem padronizada evitando enumeração de usuários
          throw new InvalidCredentialsError();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = String(token.id || "");
        (session.user as { role?: string }).role = String(token.role || "user");
      }
      return session;
    },
  },
});
