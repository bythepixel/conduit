import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "../prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user) {
                    return null
                }

                const isValid = await bcrypt.compare(credentials.password, user.password)

                if (!isValid) {
                    return null
                }

                // Only allow users with isAdmin flag set to true
                if (!user.isAdmin) {
                    throw new Error("Access denied. Admin privileges required.")
                }

                return {
                    id: user.id.toString(),
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            }
        })
    ],
    pages: {
        signIn: '/auth/signin',
    },
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt"
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.isAdmin = (user as any).isAdmin
            }
            return token
        },
        async session({ session, token }) {
            if (session?.user && token.sub) {
                session.user.id = token.sub
                session.user.isAdmin = token.isAdmin as boolean
            }
            return session
        }
    }
}


