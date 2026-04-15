import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'

const Plot = createPlotlyComponent(Plotly)

export default function ChartCBR({ titulo, traces, xTitle, yTitle, height = 420 }) {
  return (
    <div className="card chart-card">
      <h3>{titulo}</h3>
      <Plot
        data={traces}
        layout={{
          autosize: true,
          height,
          margin: { l: 60, r: 20, t: 30, b: 60 },
          xaxis: { title: xTitle },
          yaxis: { title: yTitle },
          legend: { orientation: 'h', y: -0.22 },
          hovermode: 'closest',
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
        }}
        config={{
          displaylogo: false,
          responsive: true,
        }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  )
}
