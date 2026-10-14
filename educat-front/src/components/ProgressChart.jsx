// src/components/ProgressBarChart.jsx
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function ProgressChart() {
  const data = {
    labels: ["niveau 1", "Niveau 2", " Niveaux 3", "Niveaux 4", "Niveaux 5", "Niveaux 6", "Niveaux 7"],
    datasets: [
      {
        label: "Score moyen",
        data: [42, 55, 35, 68, 72, 80, 94],
        backgroundColor: "#fc8a40",
        hoverBackgroundColor: "#031632",
        borderRadius: 6,
        maxBarThickness: 36,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        backgroundColor: "#031632",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => `Score : ${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#44474d", font: { family: "Inter", size: 11 } },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: "rgba(197,198,206,0.4)" },
        border: { display: false },
        ticks: {
          color: "#44474d",
          font: { family: "Inter", size: 11 },
          callback: (value) => `${value}%`,
        },
      },
    },
  };

  return (
    <div className="w-full h-40">
      <Bar data={data} options={options} />
    </div>
  );
}

export default ProgressChart;