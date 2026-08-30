import { google } from "googleapis";
import { getServiceAccount } from "../db";

let sheetsAuthClient: any = null;

function getSheetsClient() {
  if (!sheetsAuthClient) {
    let clientEmail: string | undefined;
    let privateKey: string | undefined;

    const serviceAccount = getServiceAccount();
    if (serviceAccount && (serviceAccount as any).client_email && (serviceAccount as any).private_key) {
      clientEmail = (serviceAccount as any).client_email;
      privateKey = (serviceAccount as any).private_key;
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      privateKey = process.env.GOOGLE_PRIVATE_KEY;
    }

    if (!clientEmail || !privateKey) {
      return null;
    }

    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsAuthClient = google.sheets({ version: "v4", auth });
  }
  return sheetsAuthClient;
}

/**
 * Collects all Google Sheet IDs from environment variables.
 * Looks for GOOGLE_SHEET_ID and any variables starting with GOOGLE_SHEET_ID (e.g. GOOGLE_SHEET_ID1, GOOGLE_SHEET_ID2).
 */
function getSheetIds(): string[] {
  const ids = new Set<string>();
  
  // Standard ID
  if (process.env.GOOGLE_SHEET_ID) {
    ids.add(process.env.GOOGLE_SHEET_ID.trim());
  }

  // Numbered IDs (GOOGLE_SHEET_ID1, GOOGLE_SHEET_ID2, etc.)
  Object.keys(process.env).forEach(key => {
    if (key.startsWith("GOOGLE_SHEET_ID")) {
      const val = process.env[key]?.trim();
      if (val) ids.add(val);
    }
  });

  const result = Array.from(ids);
  if (result.length === 0) {
    console.warn("[sheets] No GOOGLE_SHEET_ID found in environment variables.");
  }
  return result;
}


/**
 * Update attendance status in the existing registration row.
 * Searches for rollNumber in Column D and updates Column F to 'Present' and Column G to timestamp.
 */
export async function appendAttendanceRow(data: {
  participantName: string;
  participantEmail: string;
  phone: string | null;
  rollNumber: string | null;
  year: string | null;
  eventName: string;
  eventDate: string;
  eventVenue: string;
}): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_attendance",
          rollNumber: data.rollNumber ? data.rollNumber.toString().trim() : "",
          name: data.participantName,
          email: data.participantEmail,
          attendance: "Present",
        }),
      });
      console.log(`[sheets] ✅ Attendance marked as Present via Webhook for ${data.participantName}`);
      return { success: true };
    } catch (err: any) {
      console.error(`[sheets] Attendance Webhook failed for ${data.participantName}:`, err.message);
    }
  }

  const sheetIds = getSheetIds();

  if (sheetIds.length === 0) {
    return { success: false, error: "GOOGLE_SHEET_ID not configured." };
  }

  if (!data.rollNumber) {
    return { success: false, error: "Roll number required to find existing row." };
  }

  const sheets = getSheetsClient();
  if (!sheets) {
    console.warn("[sheets] Google Sheets API credentials missing for appendAttendanceRow");
    return { success: false, error: "Service account credentials not configured." };
  }

  const results = await Promise.allSettled(sheetIds.map(async (sheetId) => {
    try {
      // 1. Fetch Roll Numbers from Column D to find the row
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Sheet1!D:D",
      });

      const rows = response.data.values || [];
      const rollNumberToMatch = data.rollNumber!.trim();
      
      const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === rollNumberToMatch);

      if (rowIndex === -1) {
        throw new Error(`Roll number ${rollNumberToMatch} not found in sheet ${sheetId}.`);
      }

      // 2. Update Column H (Present) for that specific row
      const updateRange = `Sheet1!H${rowIndex + 1}:H${rowIndex + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: updateRange,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            ["Present"],
          ],
        },
      });

      console.log(`[sheets] Marked attendance for ${data.participantName} at row ${rowIndex + 1} in sheet ${sheetId}`);
      return true;
    } catch (err: any) {
      console.error(`[sheets] Failed to update attendance in sheet ${sheetId}:`, err.message);
      throw err;
    }
  }));

  const failedCount = results.filter(r => r.status === "rejected").length;
  if (failedCount === sheetIds.length) {
    return { success: false, error: "Failed to update attendance in all sheets." };
  }

  return { success: true };
}

/**
 * Append a registration row to the configured Google Sheet.
 * Columns: Registration ID | Name | Email | Phone | Roll Number | Year | Branch | Event | Event Date | Venue | Timestamp
 */
export async function appendRegistrationRow(data: {
  id: string;
  participantName: string;
  participantEmail: string;
  phone: string | null;
  rollNumber: string | null;
  year: string | null;
  branch: string | null;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  createdAt: string;
}): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: data.participantName,
          branch: data.branch ?? "",
          year: data.year ?? "",
          rollNumber: data.rollNumber ? data.rollNumber.toString().trim() : "",
          phone: data.phone ?? "",
          teamName: "",
          pptLink: "",
          attendance: "Absent",
          email: data.participantEmail,
          eventName: data.eventName,
        }),
      });
      console.log(`[sheets] Appended via Webhook for ${data.participantName}`);
      return { success: true };
    } catch (err: any) {
      console.error(`[sheets] Webhook failed for ${data.participantName}:`, err.message);
    }
  }

  const sheets = getSheetsClient();
  if (!sheets) {
    console.warn("[sheets] Google Sheets API credentials missing. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY or GOOGLE_SHEET_WEBHOOK_URL in .env");
    return { success: false, error: "Google Sheets credentials or Webhook URL not configured." };
  }

  const results = await Promise.allSettled(sheetIds.map(async (sheetId) => {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              data.participantName,
              data.branch ?? "",
              data.year ?? "",
              data.rollNumber ? data.rollNumber.toString().trim() : "",
              data.phone ?? "",
              "", // Column F: TeamName
              "", // Column G: PPT Link
              "Absent", // Column H: Attendance
            ],
          ],
        },
      });
      console.log(`[sheets] Appended registration row for ${data.participantName} in sheet ${sheetId}`);
      return true;
    } catch (err: any) {
      console.error(`[sheets] Failed to append registration row in sheet ${sheetId}:`, err.message);
      throw err;
    }
  }));

  const failedCount = results.filter(r => r.status === "rejected").length;
  if (failedCount === sheetIds.length) {
    return { success: false, error: "Failed to append registration row in all sheets." };
  }

  return { success: true };
}

/**
 * Append a Team registration row to the Google Sheet.
 * Columns: Team Name | Member 1 Name | Member 1 Email | Member 1 Roll | Member 1 Year | Member 1 Branch | Member 1 Phone | ... Member 2 ... Member 3 ... Member 4 ... | PPT Link | Attendance (Absent) | Timestamp
 */
export async function appendTeamRegistrationRow(data: {
  teamName: string;
  members: any[];
  pptLink: string;
}): Promise<{ success: boolean; error?: string }> {
  const sheetIds = getSheetIds();

  if (sheetIds.length === 0) {
    return { success: false, error: "GOOGLE_SHEET_ID not configured." };
  }

  const rowsToAppend = data.members.map((member, index) => {
    if (index === 0) {
      return [
        member.name || "",
        member.branch || "",
        member.year || "",
        member.rollNumber || "",
        member.phone || "",
        data.teamName || "",
        data.pptLink || "",
        "Absent"
      ];
    } else {
      return [
        member.name || "",
        member.branch || "",
        member.year || "",
        member.rollNumber || "",
        member.phone || "",
        "", // blank team name
        "", // blank ppt link
        "Absent" // Attendance
      ];
    }
  });

  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      for (const row of rowsToAppend) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register",
            name: row[0],
            branch: row[1],
            year: row[2],
            rollNumber: row[3],
            phone: row[4],
            teamName: row[5],
            pptLink: row[6],
            attendance: row[7],
          }),
        });
      }
      console.log(`[sheets] Appended team registration via Webhook for ${data.teamName}`);
      return { success: true };
    } catch (err: any) {
      console.error(`[sheets] Webhook failed for team ${data.teamName}:`, err.message);
    }
  }

  const sheets = getSheetsClient();
  if (!sheets) {
    console.warn("[sheets] Google Sheets credentials missing. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY or GOOGLE_SHEET_WEBHOOK_URL in .env");
    return { success: false, error: "Google Sheets credentials or Webhook URL not configured." };
  }

  const results = await Promise.allSettled(sheetIds.map(async (sheetId) => {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rowsToAppend,
        },
      });
      console.log(`[sheets] Appended team registration for ${data.teamName} in sheet ${sheetId}`);
      return true;
    } catch (err: any) {
      console.error(`[sheets] Failed to append team registration in sheet ${sheetId}:`, err.message);
      throw err;
    }
  }));

  const failedCount = results.filter(r => r.status === "rejected").length;
  if (failedCount === sheetIds.length) {
    return { success: false, error: "Failed to append team registration in all sheets." };
  }

  return { success: true };
}


