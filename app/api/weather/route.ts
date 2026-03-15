import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', '31.9964');
    url.searchParams.set('longitude', '34.8792');
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weathercode');
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode');
    url.searchParams.set('timezone', 'Asia/Jerusalem');
    url.searchParams.set('forecast_days', '2');

    const res = await fetch(url.toString());

    if (!res.ok) {
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }

    const data = await res.json();

    const hourlyTimes: string[] = data.hourly.time;
    const hourlyTemp: number[] = data.hourly.temperature_2m;
    const hourlyRain: number[] = data.hourly.precipitation_probability;
    const hourlyCode: number[] = data.hourly.weathercode;

    const dailyMin: number[] = data.daily.temperature_2m_min;
    const dailyMax: number[] = data.daily.temperature_2m_max;
    const dailyRain: number[] = data.daily.precipitation_probability_max;
    const dailyCode: number[] = data.daily.weathercode;

    // Find current hour index: match YYYY-MM-DDTHH:00
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const currentHourStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;

    const currentIndex = hourlyTimes.findIndex((t) => t === currentHourStr);

    if (currentIndex === -1) {
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }

    const current = {
      temp: hourlyTemp[currentIndex],
      rain: hourlyRain[currentIndex],
      code: hourlyCode[currentIndex],
    };

    const hourly = Array.from({ length: 4 }, (_, i) => {
      const idx = currentIndex + i;
      const timeStr = hourlyTimes[idx];
      // Extract HH:MM from YYYY-MM-DDTHH:MM
      const timePart = timeStr ? timeStr.slice(11, 16) : '';
      return {
        time: timePart,
        temp: hourlyTemp[idx],
        rain: hourlyRain[idx],
        code: hourlyCode[idx],
      };
    });

    const today = {
      min: dailyMin[0],
      max: dailyMax[0],
      rain: dailyRain[0],
      code: dailyCode[0],
    };

    const tomorrow = {
      min: dailyMin[1],
      max: dailyMax[1],
      rain: dailyRain[1],
      code: dailyCode[1],
    };

    return NextResponse.json({ current, hourly, today, tomorrow });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
