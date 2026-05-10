// API Route for parsing Pokemon save files
// Accepts uploaded .sav/.srm files and returns parsed data

import { NextRequest, NextResponse } from "next/server";
import { parseSaveFile, isValidSaveFile } from "@/lib/pokemon/parsers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file
    if (!isValidSaveFile(file.name, file.size)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid save file. Expected .sav or .srm file with size 32KB (Gen 1/2) or 128KB (Gen 3). Got: ${file.name} (${file.size} bytes)`,
        },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();

    // Parse the save file
    const result = parseSaveFile(buffer, file.name);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        filename: file.name,
        filesize: file.size,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to parse save file",
      },
      { status: 500 }
    );
  }
}
