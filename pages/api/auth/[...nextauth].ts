import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "../../../lib/prisma"
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

                return {
                    id: user.id.toString(),
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email
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
        async session({ session, token }) {
            if (session?.user && token.sub) {
                session.user.id = token.sub
            }
            return session
        }
    }
}

export default NextAuth(authOptions)
