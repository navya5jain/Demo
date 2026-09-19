import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import Chart from "chart.js/auto";
import "./Predictions.css";

export default function Predictions({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    axios
      .get(`/api/predictions/${userId}`)
      .then((res) => mounted && setData(res.data))
      .catch(() => mounted && setError("Could not load predictions."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!data || !data.category_forecast?.length || !canvasRef.current) return;

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: data.category_forecast.map((c) => c.category),
        datasets: [
          {
            label: "Projected (Rs)",
            data: data.category_forecast.map((c) => c.projected_month_total),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

  if (loading) return <div className="predictions-card loading">Loading predictions…</div>;
  if (error) return <div className="predictions-card error">{error}</div>;
  if (!data) return null;

  const trendLabel = {
    rising: "Spending is trending up",
    falling: "Spending is trending down",
    stable: "Spending is steady",
    insufficient_data: "Not enough data yet",
  }[data.trend];

  return (
    <div className="predictions-card">
      <div className="predictions-header">
        <h3>Month-End Prediction</h3>
        <span className={`confidence-badge confidence-${confidenceTier(data.confidence)}`}>
          {data.confidence}% confidence
        </span>
      </div>

      <div className="predictions-main-stats">
        <div className="stat">
          <span className="stat-label">Predicted total</span>
          <span className="stat-value">Rs {data.predicted_total}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Safe daily limit</span>
          <span className="stat-value highlight">Rs {data.safe_daily_limit}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Days remaining</span>
          <span className="stat-value">{data.days_remaining}</span>
        </div>
      </div>

      <p className="trend-note">{trendLabel}</p>

      {data.will_exceed_budget && (
        <div className="overspend-warning">
          Projected to exceed budget by Rs {data.projected_overspend}. Consider trimming your top category below.
        </div>
      )}

      {data.category_forecast?.length > 0 && (
        <div className="category-chart">
          <h4>Projected spend by category</h4>
          <canvas ref={canvasRef} height="180" />
        </div>
      )}
    </div>
  );
}

function confidenceTier(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
