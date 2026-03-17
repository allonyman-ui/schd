import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const full = request.nextUrl.searchParams.get('full') === 'true'
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', '31.9964');
    url.searchParams.set('longitude', '34.8792');
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weathercode,windspeed_10m,relativehumidity_2m');
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,sunrise,sunset');
    url.searchParams.set('timezone', 'Asia/Jerusalem');
    url.searchParams.set('forecast_days', full ? '3' : '2');

    const res = await fetch(url.toString());

    if (!res.ok) {
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }

    const data = await res.json();

    const hourlyTimes: string[] = data.hourly.time;
    const hourlyTemp: number[] = data.hourly.temperature_2m;
    const hourlyRain: number[] = data.hourly.precipitation_probability;
    const hourlyCode: number[] = data.hourly.weathercode;
    const hourlyWind: number[] = data.hourly.windspeed_10m || [];
    const hourlyHumid: number[] = data.hourly.relativehumidity_2m || [];

    const dailyMin: number[] = data.daily.temperature_2m_min;
    const dailyMax: number[] = data.daily.temperature_2m_max;
    const dailyRain: number[] = data.daily.precipitation_probability_max;
    const dailyCode: number[] = data.daily.weathercode;
    const dailySunrise: string[] = data.daily.sunrise || [];
    const dailySunset: string[] = data.daily.sunset || [];

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
      wind: hourlyWind[currentIndex] || 0,
      humidity: hourlyHumid[currentIndex] || 0,
    };

    // For full mode: 48 hours; for standard: 4 hours
    const hourlyCount = full ? 48 : 4
    const hourly = Array.from({ length: hourlyCount }, (_, i) => {
      const idx = currentIndex + i;
      if (idx >= hourlyTimes.length) return null
      const timeStr = hourlyTimes[idx];
      const timePart = timeStr ? timeStr.slice(11, 16) : '';
      const datePart = timeStr ? timeStr.slice(0, 10) : '';
      return {
        time: timePart,
        date: datePart,
        temp: hourlyTemp[idx],
        rain: hourlyRain[idx],
        code: hourlyCode[idx],
        wind: hourlyWind[idx] || 0,
        humidity: hourlyHumid[idx] || 0,
      };
    }).filter(Boolean);

    const today = {
      min: dailyMin[0], max: dailyMax[0],
      rain: dailyRain[0], code: dailyCode[0],
      sunrise: dailySunrise[0] ? dailySunrise[0].slice(11, 16) : null,
      sunset: dailySunset[0] ? dailySunset[0].slice(11, 16) : null,
    };

    const tomorrow = {
      min: dailyMin[1], max: dailyMax[1],
      rain: dailyRain[1], code: dailyCode[1],
      sunrise: dailySunrise[1] ? dailySunrise[1].slice(11, 16) : null,
      sunset: dailySunset[1] ? dailySunset[1].slice(11, 16) : null,
    };

    const dayAfter = full && dailyMin[2] !== undefined ? {
      min: dailyMin[2], max: dailyMax[2],
      rain: dailyRain[2], code: dailyCode[2],
      sunrise: dailySunrise[2] ? dailySunrise[2].slice(11, 16) : null,
      sunset: dailySunset[2] ? dailySunset[2].slice(11, 16) : null,
    } : null

    return NextResponse.json({ current, hourly, today, tomorrow, ...(dayAfter ? { dayAfter } : {}) });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
