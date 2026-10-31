import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const destination = new URL("/profile?payment=return", request.url);
  return NextResponse.redirect(destination);
}
