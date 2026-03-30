import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("Feedback Recieved:", body);
        
        // Save to database later.
        return NextResponse.json({ success: true });
    } catch (error){
        return NextResponse.json(
            { success: false, error: "Invalid request"},
            { status: 400}
        )
    }
}