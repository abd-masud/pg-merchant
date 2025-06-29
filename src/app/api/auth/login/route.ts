import jwt from 'jsonwebtoken';
import { compare } from 'bcryptjs';
import { NextRequest } from 'next/server';
import { connectionToDatabase } from '@/util/db';

const SECRET_KEY = process.env.SECRET_KEY as string;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY is not defined in the environment variables.");
}

export async function POST(request: NextRequest) {
    try {
        // Parse the request body
        const requestBody = await request.json();

        // Check if email and password are provided
        if (!requestBody.email || !requestBody.password) {
            return new Response(JSON.stringify({ error: 'Email and password are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const db = await connectionToDatabase();

        // Check if the user exists in the database
        const userQuery = await db.query(
            'SELECT * FROM "users" WHERE TRIM(email) = $1',
            [requestBody.email]
        );

        if (userQuery.rows.length == 0) {
            return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const user = userQuery.rows[0];

        // Validate the password
        const isPasswordValid = await compare(requestBody.password, user.password.trim());
        if (!isPasswordValid) {
            return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if user has vendor role
        if (user.role.trim() !== 'vendor') {
            return new Response(JSON.stringify({ error: 'Access denied.' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                contact: user.contact,
                role: user.role,
                image: user.image
            },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        // Send back the token and user data
        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            contact: user.contact,
            role: user.role,
            image: user.image
        };

        return new Response(
            JSON.stringify({ token, user: userData }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Authentication error:', error);
        // Return error if authentication fails
        return new Response(
            JSON.stringify({ error: 'Failed to authenticate user' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
