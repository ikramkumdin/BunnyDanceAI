import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    GROK_API_KEY: process.env.GROK_API_KEY ? "SET" : "NOT_SET",
    KIE_MODEL: process.env.KIE_MODEL || "NOT_SET",
    KIE_CALLBACK_URL: process.env.KIE_CALLBACK_URL || "NOT_SET",
    KIE_WATERMARK: process.env.KIE_WATERMARK || "NOT_SET",
    KIE_SEED: process.env.KIE_SEED || "NOT_SET",
    GROK_API_URL: process.env.GROK_API_URL || "NOT_SET"
  });
}
