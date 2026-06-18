import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const guests = await db.guest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ guests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email } = body;

    const newGuest = await db.guest.create({
      data: {
        name,
        email,
      },
    });

    return NextResponse.json({ guest: newGuest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
