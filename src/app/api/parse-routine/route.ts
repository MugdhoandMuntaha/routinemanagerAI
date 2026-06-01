import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { fileBase64 } = await request.json();

    if (!fileBase64) {
      return NextResponse.json(
        { error: 'Missing PDF file base64 data.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not defined in environment variables.');
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 500 }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Parse this class schedule/routine PDF. Extract all courses and their schedule times (periods). Provide your answer strictly as a JSON object matching this schema:

{
  "courses": [
    {
      "course_name": "string (e.g. Software Engineering)",
      "course_code": "string (e.g. CSE-3101)",
      "teacher_name": "string (e.g. Dr. John Doe, leave empty string if not found)",
      "room_number": "string (e.g. Room 402, leave empty string if not found)",
      "credit_hours": number (defaults to 3 if not found)
    }
  ],
  "periods": [
    {
      "course_code": "string (matching the course_code in the courses array)",
      "course_name": "string (matching the course_name in the courses array)",
      "day_of_week": number (0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday. MUST be an integer from 0 to 6)",
      "start_time": "string (start time in 24-hour format HH:MM:SS, e.g. 09:00:00 or 14:30:00. MUST follow this format exactly)",
      "duration_minutes": number (class duration in minutes, e.g. 60, 90, 120. Calculate this by subtracting start time from end time of the class)",
      "room_number": "string (specific room number for this class if specified, or default course room)"
    }
  ]
}

Strictly follow these rules:
1. If a class spans multiple days, output separate period entries for each day.
2. Ensure start_time is in 24-hour HH:MM:SS format. If the time is AM/PM, convert it correctly. (e.g. 2:00 PM -> 14:00:00).
3. Day indices must be: Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6.
4. Output raw JSON only. Do not wrap the JSON output in markdown formatting.`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: fileBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API request failed:', errorText);
      return NextResponse.json(
        { error: `Gemini API request failed: ${response.statusText}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error('Gemini API returned an empty response:', result);
      return NextResponse.json(
        { error: 'Gemini API failed to return parsed content.' },
        { status: 502 }
      );
    }

    // Parse the response text as JSON to validate it and send it clean to the client
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (e: any) {
      console.error('Failed to parse Gemini output text as JSON. Text:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI output as valid JSON structure.' },
        { status: 502 }
      );
    }

    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error('Unexpected error in parse-routine route:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error occurred.' },
      { status: 500 }
    );
  }
}
