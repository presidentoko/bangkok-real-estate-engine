type Props = {
  aqi: number | null;
  pm25: number | null;
  stationName: string | null;
  fetchedAt: string | null;
};

function aqiLabel(aqi: number): {
  text: string;
  className: string;
} {
  if (aqi <= 50)  return { text: "Good",                    className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (aqi <= 100) return { text: "Moderate",                className: "text-yellow-300  bg-yellow-500/10  border-yellow-500/30"  };
  if (aqi <= 150) return { text: "Unhealthy (sensitive)",   className: "text-orange-400  bg-orange-500/10  border-orange-500/30"  };
  if (aqi <= 200) return { text: "Unhealthy",               className: "text-rose-400    bg-rose-500/10    border-rose-500/30"    };
  if (aqi <= 300) return { text: "Very unhealthy",          className: "text-rose-500    bg-rose-500/15    border-rose-500/40"    };
  return            { text: "Hazardous",                    className: "text-rose-600    bg-rose-600/20    border-rose-600/50"    };
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/**
 * Air-quality snapshot — AQI + PM2.5 from the nearest WAQI station.
 * Hidden when we haven't fetched yet for this condo's coordinates.
 */
export function AirQualityCard({ aqi, pm25, stationName, fetchedAt }: Props) {
  if (aqi == null) return null;
  const label = aqiLabel(aqi);

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">Air quality</h2>
        <span className="text-xs text-zinc-500">
          {fetchedAt && relativeAge(fetchedAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-4">
        <div>
          <div className="text-4xl font-bold tabular-nums">{aqi}</div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
            AQI
          </div>
        </div>

        <div
          className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${label.className}`}
        >
          {label.text}
        </div>

        {pm25 != null && (
          <div className="text-zinc-400 text-sm">
            <span className="text-zinc-500">PM2.5</span>{" "}
            <span className="font-semibold text-zinc-200 tabular-nums">
              {pm25.toFixed(1)}
            </span>{" "}
            μg/m³
          </div>
        )}
      </div>

      {stationName && (
        <p className="text-zinc-500 text-xs mt-3">
          Source: WAQI station <span className="text-zinc-400">{stationName}</span>.
          AQI is a 0–500 composite scale (US EPA). Values above 100 are unhealthy
          for sensitive groups; above 150 for everyone.
        </p>
      )}
    </section>
  );
}
