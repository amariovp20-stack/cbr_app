import { useMemo, useState } from 'react'
import { calcularCBR } from './lib/api'
import ChartCBR from './components/ChartCBR'
import AppLogo from './components/AppLogo'

const basePoints = [
  { penetracion: 0, carga: 0 },
  { penetracion: 0.64, carga: 80 },
  { penetracion: 1.27, carga: 210 },
  { penetracion: 1.91, carga: 410 },
  { penetracion: 2.54, carga: 690 },
  { penetracion: 3.81, carga: 1030 },
  { penetracion: 5.08, carga: 1420 },
  { penetracion: 7.62, carga: 1880 },
  { penetracion: 10.16, carga: 2340 },
  { penetracion: 12.7, carga: 2700 },
]

function createMold(index) {
  return {
    molde_id: `Molde ${index + 1}`,
    golpes: index === 0 ? 10 : index === 1 ? 25 : 56,
    diametro_molde_cm: '15.24',
    altura_molde_cm: '17.7',
    peso_molde_g: '',
    peso_molde_mas_muestra_humeda_g: '',
    peso_molde_mas_muestra_humeda_saturada_g: '',
    peso_tara_g: '',
    peso_tara_mas_muestra_humeda_g: '',
    peso_tara_mas_muestra_seca_g: '',
    peso_tara_saturada_g: '',
    peso_tara_mas_muestra_humeda_saturada_g: '',
    peso_tara_mas_muestra_seca_saturada_g: '',
    modo_hinchamiento: 'total',
    lectura_hinchamiento_inicial_mm: '',
    lectura_hinchamiento_final_mm: '',
    lectura_hinchamiento_24h_mm: '',
    lectura_hinchamiento_48h_mm: '',
    lectura_hinchamiento_72h_mm: '',
    lectura_hinchamiento_96h_mm: '',
    observaciones: '',
    puntos: basePoints.map((point) => ({ ...point })),
  }
}

function createInitialProjectInfo() {
  return {
    proyecto: '',
    cliente: '',
    ubicacion: '',
    tramo: '',
    laboratorio: '',
    norma_referencia: 'ASTM D1883',
    operador: '',
    revisor: '',
    fecha: '',
    observaciones: '',
  }
}

function createInitialSampleInfo() {
  return {
    muestra_id: '',
    descripcion_material: '',
    procedencia: '',
    profundidad: '',
    energia_compactacion: '',
    condicion_ensayo: 'sin_empapar',
  }
}

function createInitialConfig() {
  return {
    modo: 'reporte_completo',
    usar_correccion: true,
    unidad_penetracion_entrada: 'mm',
    unidad_carga_entrada: 'kg',
    unidad_penetracion_reporte: 'mm',
    unidad_carga_reporte: 'kg',
  }
}

function createInitialMolds() {
  return [createMold(0), createMold(1), createMold(2)]
}

function emptyIfBlank(value) {
  return value === '' ? null : Number(value)
}

function roundValue(value, digits = 4) {
  if (value == null || Number.isNaN(value)) return null
  return Number(value.toFixed(digits))
}

function classifyAlarm(message) {
  return message.startsWith('Alarma:') ? 'warning' : 'error'
}

function alarmLabel(level) {
  return level === 'warning' ? 'Advertencia' : 'Error critico'
}

function countAlarms(messages = []) {
  return messages.reduce(
    (acc, message) => {
      const level = classifyAlarm(message)
      if (level === 'warning') acc.warnings += 1
      else acc.errors += 1
      return acc
    },
    { warnings: 0, errors: 0 }
  )
}

function moldToneClass(counts) {
  if (counts.errors > 0) return 'mold-critical'
  if (counts.warnings > 0) return 'mold-warning'
  return 'mold-clean'
}

const swellReadingFields = [
  ['24h', 'lectura_hinchamiento_24h_mm'],
  ['48h', 'lectura_hinchamiento_48h_mm'],
  ['72h', 'lectura_hinchamiento_72h_mm'],
  ['96h', 'lectura_hinchamiento_96h_mm'],
]

function formatConditionLabel(value) {
  const labels = {
    sin_empapar: 'Sin empapar',
    empapada_4_dias: 'Despues de empapar 4 dias',
    saturada_en_agua: 'Saturada en agua',
    natural: 'Natural',
  }
  return labels[value] || value || 'No especificada'
}

function calculateMoldPreview(molde) {
  const diametro = emptyIfBlank(molde.diametro_molde_cm)
  const altura = emptyIfBlank(molde.altura_molde_cm)
  const pesoMolde = emptyIfBlank(molde.peso_molde_g)
  const pesoMoldeMasHumeda = emptyIfBlank(molde.peso_molde_mas_muestra_humeda_g)
  const pesoMoldeMasHumedaSaturada = emptyIfBlank(molde.peso_molde_mas_muestra_humeda_saturada_g)
  const pesoTara = emptyIfBlank(molde.peso_tara_g)
  const pesoTaraMasHumeda = emptyIfBlank(molde.peso_tara_mas_muestra_humeda_g)
  const pesoTaraMasSeca = emptyIfBlank(molde.peso_tara_mas_muestra_seca_g)
  const pesoTaraSaturada = emptyIfBlank(molde.peso_tara_saturada_g)
  const pesoTaraMasHumedaSaturada = emptyIfBlank(molde.peso_tara_mas_muestra_humeda_saturada_g)
  const pesoTaraMasSecaSaturada = emptyIfBlank(molde.peso_tara_mas_muestra_seca_saturada_g)
  const hinchamientoInicial = emptyIfBlank(molde.lectura_hinchamiento_inicial_mm)
  const hinchamientoFinal = emptyIfBlank(molde.lectura_hinchamiento_final_mm)
  const lecturas24h = swellReadingFields.map(([label, key]) => ({
    label,
    value: emptyIfBlank(molde[key]),
  }))

  const alarms = []

  const volumen =
    diametro && altura
      ? Math.PI * ((diametro / 2) ** 2) * altura
      : null

  let masaHumeda = null
  if (pesoMolde != null && pesoMoldeMasHumeda != null) {
    if (pesoMoldeMasHumeda <= pesoMolde) {
      alarms.push('El peso del molde + muestra húmeda debe ser mayor que el peso del molde.')
    } else {
      masaHumeda = pesoMoldeMasHumeda - pesoMolde
    }
  }

  let masaHumedaSaturada = null
  if (pesoMolde != null && pesoMoldeMasHumedaSaturada != null) {
    if (pesoMoldeMasHumedaSaturada <= pesoMolde) {
      alarms.push('El peso del molde + muestra humeda saturada debe ser mayor que el peso del molde.')
    } else {
      masaHumedaSaturada = pesoMoldeMasHumedaSaturada - pesoMolde
    }
  }

  let masaHumedaTara = null
  let masaSecaTara = null
  let humedad = null
  if (pesoTara != null && pesoTaraMasHumeda != null && pesoTaraMasSeca != null) {
    if (pesoTaraMasHumeda <= pesoTara) {
      alarms.push('El peso húmedo + tara debe ser mayor que el peso de tara.')
    } else {
      masaHumedaTara = pesoTaraMasHumeda - pesoTara
    }

    if (pesoTaraMasSeca <= pesoTara) {
      alarms.push('El peso seco + tara debe ser mayor que el peso de tara.')
    } else {
      masaSecaTara = pesoTaraMasSeca - pesoTara
    }

    if (masaHumedaTara != null && masaSecaTara != null) {
      if (masaHumedaTara <= masaSecaTara) {
        alarms.push('La muestra húmeda para contenido de agua debe pesar más que la muestra seca.')
      } else if (masaSecaTara <= 0) {
        alarms.push('La muestra seca usada para humedad debe ser mayor que cero.')
      } else {
        humedad = ((masaHumedaTara - masaSecaTara) / masaSecaTara) * 100
      }
    }
  }

  let masaHumedaTaraSaturada = null
  let masaSecaTaraSaturada = null
  let humedadSaturada = null
  if (pesoTaraSaturada != null && pesoTaraMasHumedaSaturada != null && pesoTaraMasSecaSaturada != null) {
    if (pesoTaraMasHumedaSaturada <= pesoTaraSaturada) {
      alarms.push('El peso humedo saturado + tara debe ser mayor que el peso de tara.')
    } else {
      masaHumedaTaraSaturada = pesoTaraMasHumedaSaturada - pesoTaraSaturada
    }

    if (pesoTaraMasSecaSaturada <= pesoTaraSaturada) {
      alarms.push('El peso seco saturado + tara debe ser mayor que el peso de tara.')
    } else {
      masaSecaTaraSaturada = pesoTaraMasSecaSaturada - pesoTaraSaturada
    }

    if (masaHumedaTaraSaturada != null && masaSecaTaraSaturada != null) {
      if (masaHumedaTaraSaturada <= masaSecaTaraSaturada) {
        alarms.push('La muestra humeda saturada para contenido de agua debe pesar mas que la muestra seca.')
      } else if (masaSecaTaraSaturada <= 0) {
        alarms.push('La muestra seca saturada usada para humedad debe ser mayor que cero.')
      } else {
        humedadSaturada = ((masaHumedaTaraSaturada - masaSecaTaraSaturada) / masaSecaTaraSaturada) * 100
      }
    }
  }

  const densidadHumeda = masaHumeda != null && volumen ? masaHumeda / volumen : null
  const densidadSeca =
    densidadHumeda != null && humedad != null ? densidadHumeda / (1 + humedad / 100) : null
  const ultimaLectura24h = lecturas24h.reduce(
    (last, reading) => (reading.value != null ? reading.value : last),
    null
  )
  const lecturaFinalUtilizada =
    molde.modo_hinchamiento === 'cada_24_horas'
      ? (ultimaLectura24h ?? hinchamientoFinal)
      : hinchamientoFinal
  const hinchamiento =
    hinchamientoInicial != null && lecturaFinalUtilizada != null && altura
      ? ((lecturaFinalUtilizada - hinchamientoInicial) / (altura * 10)) * 100
      : null
  const deltaHinchamientoMm =
    hinchamientoInicial != null && lecturaFinalUtilizada != null
      ? Math.max(0, lecturaFinalUtilizada - hinchamientoInicial)
      : null
  const volumenSaturado =
    volumen != null && altura != null && deltaHinchamientoMm != null
      ? volumen * ((altura + deltaHinchamientoMm / 10) / altura)
      : null
  const densidadHumedaSaturada =
    masaHumedaSaturada != null && volumenSaturado != null ? masaHumedaSaturada / volumenSaturado : null
  const densidadSecaSaturada =
    densidadHumedaSaturada != null && humedadSaturada != null
      ? densidadHumedaSaturada / (1 + humedadSaturada / 100)
      : null
  const hinchamientoPorLectura = lecturas24h.map((reading) => ({
    ...reading,
    porcentaje:
      hinchamientoInicial != null && reading.value != null && altura
        ? ((reading.value - hinchamientoInicial) / (altura * 10)) * 100
        : null,
  }))

  if (molde.modo_hinchamiento === 'cada_24_horas' && ultimaLectura24h == null && hinchamientoFinal == null) {
    alarms.push('Debes ingresar al menos una lectura de hinchamiento cada 24 horas o una lectura final total.')
  }

  if (volumen != null && (volumen < 2000 || volumen > 2300)) {
    alarms.push(`Alarma: el volumen calculado del molde es ${roundValue(volumen)} cm3 y está fuera del rango típico de control para CBR.`)
  }
  if (humedad != null && (humedad < 0 || humedad > 60)) {
    alarms.push(`Alarma: la humedad calculada es ${roundValue(humedad)} % y está fuera de parámetros de control razonables.`)
  }
  if (densidadHumeda != null && (densidadHumeda < 1.2 || densidadHumeda > 2.4)) {
    alarms.push(`Alarma: la densidad húmeda calculada es ${roundValue(densidadHumeda)} g/cm3 y está fuera del rango usual de control.`)
  }
  if (densidadSeca != null && (densidadSeca < 1.0 || densidadSeca > 2.3)) {
    alarms.push(`Alarma: la densidad seca calculada es ${roundValue(densidadSeca)} g/cm3 y está fuera del rango usual de control.`)
  }
  if (volumenSaturado != null && (volumenSaturado < 2000 || volumenSaturado > 2400)) {
    alarms.push(`Alarma: el volumen post-saturacion calculado es ${roundValue(volumenSaturado)} cm3 y esta fuera del rango usual de control.`)
  }
  if (humedadSaturada != null && (humedadSaturada < 0 || humedadSaturada > 80)) {
    alarms.push(`Alarma: la humedad saturada calculada es ${roundValue(humedadSaturada)} % y esta fuera de parametros de control razonables.`)
  }
  if (densidadHumedaSaturada != null && (densidadHumedaSaturada < 1.2 || densidadHumedaSaturada > 2.4)) {
    alarms.push(`Alarma: la densidad humeda post-saturacion calculada es ${roundValue(densidadHumedaSaturada)} g/cm3 y esta fuera del rango usual de control.`)
  }
  if (densidadSecaSaturada != null && (densidadSecaSaturada < 1.0 || densidadSecaSaturada > 2.3)) {
    alarms.push(`Alarma: la densidad seca post-saturacion calculada es ${roundValue(densidadSecaSaturada)} g/cm3 y esta fuera del rango usual de control.`)
  }
  if (hinchamiento != null && hinchamiento > 5) {
    alarms.push(`Alarma: el hinchamiento calculado es ${roundValue(hinchamiento)} % y supera 5%; revisa las lecturas del molde.`)
  }

  return {
    volumen: roundValue(volumen),
    volumenSaturado: roundValue(volumenSaturado),
    masaHumeda: roundValue(masaHumeda),
    masaHumedaSaturada: roundValue(masaHumedaSaturada),
    masaHumedaTara: roundValue(masaHumedaTara),
    masaSecaTara: roundValue(masaSecaTara),
    masaHumedaTaraSaturada: roundValue(masaHumedaTaraSaturada),
    masaSecaTaraSaturada: roundValue(masaSecaTaraSaturada),
    humedad: roundValue(humedad),
    humedadSaturada: roundValue(humedadSaturada),
    densidadHumeda: roundValue(densidadHumeda),
    densidadSeca: roundValue(densidadSeca),
    densidadHumedaSaturada: roundValue(densidadHumedaSaturada),
    densidadSecaSaturada: roundValue(densidadSecaSaturada),
    modoHinchamiento: molde.modo_hinchamiento,
    deltaHinchamientoMm: roundValue(deltaHinchamientoMm),
    lecturaFinalUtilizada: roundValue(lecturaFinalUtilizada),
    hinchamientoPorLectura: hinchamientoPorLectura.map((reading) => ({
      label: reading.label,
      value: roundValue(reading.value),
      porcentaje: roundValue(reading.porcentaje),
    })),
    hinchamiento: roundValue(hinchamiento),
    alarms,
  }
}

function moldResultCards(molde) {
  return [
    ['Golpes', molde.golpes],
    ['CBR 2.54', `${molde.resultados.cbr_2_54_pct} %`],
    ['CBR 5.08', `${molde.resultados.cbr_5_08_pct} %`],
    ['CBR final', `${molde.resultados.cbr_final_pct} %`],
    ['Carga 2.54', `${molde.resultados.carga_2_54} ${molde.resultados.unidad_carga}`],
    ['Carga 5.08', `${molde.resultados.carga_5_08} ${molde.resultados.unidad_carga}`],
    ['Penetracion control', `${molde.resultados.penetracion_control} ${molde.resultados.unidad_penetracion}`],
    ['Densidad humeda', molde.lecturas?.densidad_humeda_g_cm3 != null ? `${molde.lecturas.densidad_humeda_g_cm3} g/cm3` : 'No disponible'],
    ['Densidad seca', molde.lecturas?.densidad_seca_g_cm3 != null ? `${molde.lecturas.densidad_seca_g_cm3} g/cm3` : 'No disponible'],
    ['Volumen post-saturacion', molde.lecturas?.volumen_post_saturacion_cm3 != null ? `${molde.lecturas.volumen_post_saturacion_cm3} cm3` : 'No disponible'],
    ['Densidad humeda post-saturacion', molde.lecturas?.densidad_humeda_saturada_g_cm3 != null ? `${molde.lecturas.densidad_humeda_saturada_g_cm3} g/cm3` : 'No disponible'],
    ['Densidad seca post-saturacion', molde.lecturas?.densidad_seca_saturada_g_cm3 != null ? `${molde.lecturas.densidad_seca_saturada_g_cm3} g/cm3` : 'No disponible'],
    ['Humedad', molde.lecturas?.humedad_porcentaje != null ? `${molde.lecturas.humedad_porcentaje} %` : 'No disponible'],
    ['Humedad post-saturacion', molde.lecturas?.humedad_saturada_porcentaje != null ? `${molde.lecturas.humedad_saturada_porcentaje} %` : 'No disponible'],
    ['Modo de hinchamiento', molde.lecturas?.modo_hinchamiento === 'cada_24_horas' ? 'Lecturas cada 24 horas' : 'Total acumulado'],
    ['Hinchamiento final', molde.lecturas?.hinchamiento_porcentaje != null ? `${molde.lecturas.hinchamiento_porcentaje} %` : 'No disponible'],
  ]
}

function moldSummaryCards(molde) {
  return [
    ['Golpes', molde.golpes],
    ['Volumen inicial', molde.lecturas?.volumen_molde_cm3 != null ? `${molde.lecturas.volumen_molde_cm3} cm3` : 'No disponible'],
    ['Volumen post-saturacion', molde.lecturas?.volumen_post_saturacion_cm3 != null ? `${molde.lecturas.volumen_post_saturacion_cm3} cm3` : 'No disponible'],
    ['Hinchamiento final', molde.lecturas?.hinchamiento_porcentaje != null ? `${molde.lecturas.hinchamiento_porcentaje} %` : 'No disponible'],
    ['Lectura final de hinchamiento', molde.lecturas?.lectura_hinchamiento_final_utilizada_mm != null ? `${molde.lecturas.lectura_hinchamiento_final_utilizada_mm} mm` : 'No disponible'],
    ['Densidad humeda inicial', molde.lecturas?.densidad_humeda_g_cm3 != null ? `${molde.lecturas.densidad_humeda_g_cm3} g/cm3` : 'No disponible'],
    ['Densidad seca inicial', molde.lecturas?.densidad_seca_g_cm3 != null ? `${molde.lecturas.densidad_seca_g_cm3} g/cm3` : 'No disponible'],
    ['Densidad humeda post-saturacion', molde.lecturas?.densidad_humeda_saturada_g_cm3 != null ? `${molde.lecturas.densidad_humeda_saturada_g_cm3} g/cm3` : 'No disponible'],
    ['Densidad seca post-saturacion', molde.lecturas?.densidad_seca_saturada_g_cm3 != null ? `${molde.lecturas.densidad_seca_saturada_g_cm3} g/cm3` : 'No disponible'],
    ['Humedad inicial', molde.lecturas?.humedad_porcentaje != null ? `${molde.lecturas.humedad_porcentaje} %` : 'No disponible'],
    ['Humedad post-saturacion', molde.lecturas?.humedad_saturada_porcentaje != null ? `${molde.lecturas.humedad_saturada_porcentaje} %` : 'No disponible'],
    ['Modo de hinchamiento', molde.lecturas?.modo_hinchamiento === 'cada_24_horas' ? 'Lecturas cada 24 horas' : 'Total acumulado'],
  ]
}

function buildReportAssessment(result) {
  const maxCBR = result?.resumen_general?.cbr_maximo_pct
  const hasValidationIssues = !!result?.resumen_general?.hay_errores_validacion
  const sampleCondition = formatConditionLabel(result?.sample_info?.condicion_ensayo)
  const moldCount = result?.resumen_general?.cantidad_moldes

  let conclusion = 'Los resultados obtenidos permiten describir el comportamiento resistente de la muestra bajo la condicion de ensayo reportada.'
  let recommendation = 'Se recomienda archivar este reporte junto con la curva carga-penetracion y verificar coherencia con el plan de control del proyecto.'
  let classification = 'Sin clasificacion'

  if (hasValidationIssues) {
    classification = 'Resultado condicionado'
    conclusion = 'El ensayo presenta advertencias o inconsistencias en uno o mas moldes, por lo que la interpretacion debe hacerse con criterio tecnico.'
    recommendation = 'Revisar las lecturas del molde, los pesos y el hinchamiento antes de emitir una decision definitiva de diseno o aceptacion.'
  } else if (maxCBR != null && maxCBR < 3) {
    classification = 'Muy pobre'
    conclusion = `La muestra ensayada en condicion ${sampleCondition.toLowerCase()} presenta comportamiento de soporte muy pobre, con CBR maximo de ${maxCBR} % en ${moldCount} molde(s) evaluado(s).`
    recommendation = 'No se recomienda asumir este material como subrasante apta sin mejoramiento; evaluar reemplazo, estabilizacion o rediseño estructural.'
  } else if (maxCBR != null && maxCBR < 5) {
    classification = 'Pobre'
    conclusion = `La muestra ensayada en condicion ${sampleCondition.toLowerCase()} presenta una capacidad de soporte pobre, con CBR maximo de ${maxCBR} %.`
    recommendation = 'Evaluar mejoramiento del suelo, estabilizacion o reemplazo de material si este resultado se usara para subrasante o capas estructurales.'
  } else if (maxCBR != null && maxCBR < 10) {
    classification = 'Regular'
    conclusion = `La muestra ensayada en condicion ${sampleCondition.toLowerCase()} presenta una capacidad de soporte moderada-baja, con CBR maximo de ${maxCBR} %.`
    recommendation = 'Contrastar el resultado con las exigencias del proyecto y considerar control adicional de compactacion, drenaje o mejoramiento local.'
  } else if (maxCBR != null && maxCBR < 20) {
    classification = 'Buena'
    conclusion = `La muestra ensayada en condicion ${sampleCondition.toLowerCase()} presenta una capacidad de soporte buena, con CBR maximo de ${maxCBR} %.`
    recommendation = 'El material puede considerarse utilizable bajo control tecnico, verificando uniformidad del suelo, humedad de obra y drenaje del paquete estructural.'
  } else if (maxCBR != null && maxCBR < 30) {
    classification = 'Muy buena'
    conclusion = `La muestra ensayada en condicion ${sampleCondition.toLowerCase()} presenta una capacidad de soporte muy buena, con CBR maximo de ${maxCBR} %.`
    recommendation = 'Usar el valor representativo definido por el responsable tecnico y corroborar compatibilidad con las especificaciones del proyecto.'
  } else if (maxCBR != null) {
    classification = 'Excelente'
    conclusion = `La muestra ensayada en condicion ${sampleCondition.toLowerCase()} presenta una capacidad de soporte excelente, con CBR maximo de ${maxCBR} %.`
    recommendation = 'Emplear el valor representativo adoptado por el responsable tecnico y documentar la variabilidad entre moldes para fines de diseno y control.'
  }

  return { classification, conclusion, recommendation }
}

function buildCurveTraces(molde) {
  const original = molde.graficas.curva_original
  const corrected = molde.graficas.curva_corregida
  const line = molde.graficas.linea_correccion_origen
  const refs = molde.graficas.puntos_referencia

  const traces = [
    {
      x: original.map((point) => point.penetracion),
      y: original.map((point) => point.carga),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Curva original',
      line: { color: '#0f5d5e', width: 3 },
      marker: { size: 7 },
    },
  ]

  if (line?.length) {
    traces.push({
      x: line.map((point) => point.penetracion),
      y: line.map((point) => point.carga),
      type: 'scatter',
      mode: 'lines',
      name: 'Linea de correccion',
      line: { color: '#d94841', width: 2, dash: 'dash' },
    })
  }

  traces.push({
    x: corrected.map((point) => point.penetracion),
    y: corrected.map((point) => point.carga),
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Curva corregida',
    line: { color: '#f4a261', width: 3 },
    marker: { size: 6 },
  })

  traces.push({
    x: refs.map((point) => point.penetracion),
    y: refs.map((point) => point.carga),
    type: 'scatter',
    mode: 'markers+text',
    name: 'Referencias ASTM',
    text: refs.map((point) => point.etiqueta),
    textposition: 'top center',
    marker: { size: 10, color: '#264653', symbol: 'diamond' },
  })

  return traces
}

function formatDisplayDate(value) {
  if (!value) return 'No especificada'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function App() {
  const [projectInfo, setProjectInfo] = useState(createInitialProjectInfo)
  const [sampleInfo, setSampleInfo] = useState(createInitialSampleInfo)
  const [config, setConfig] = useState(createInitialConfig)
  const [moldCount, setMoldCount] = useState(3)
  const [moldes, setMoldes] = useState(createInitialMolds)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeMoldes = useMemo(() => moldes.slice(0, moldCount), [moldes, moldCount])
  const moldPreviews = useMemo(
    () => activeMoldes.map((molde) => calculateMoldPreview(molde)),
    [activeMoldes]
  )

  function updateMold(index, key, value) {
    setMoldes((current) =>
      current.map((molde, currentIndex) =>
        currentIndex === index ? { ...molde, [key]: value } : molde
      )
    )
  }

  function updatePoint(moldIndex, pointIndex, key, value) {
    setMoldes((current) =>
      current.map((molde, currentIndex) => {
        if (currentIndex !== moldIndex) return molde
        const points = [...molde.puntos]
        points[pointIndex] = {
          ...points[pointIndex],
          [key]: value === '' ? '' : Number(value),
        }
        return { ...molde, puntos: points }
      })
    )
  }

  function addPointRow(moldIndex) {
    setMoldes((current) =>
      current.map((molde, currentIndex) => {
        if (currentIndex !== moldIndex) return molde
        const last = molde.puntos[molde.puntos.length - 1]
        return {
          ...molde,
          puntos: [
            ...molde.puntos,
            {
              penetracion: Number((Number(last.penetracion || 0) + 1.27).toFixed(2)),
              carga: 0,
            },
          ],
        }
      })
    )
  }

  function removePointRow(moldIndex, pointIndex) {
    setMoldes((current) =>
      current.map((molde, currentIndex) => {
        if (currentIndex !== moldIndex || molde.puntos.length <= 3) return molde
        return {
          ...molde,
          puntos: molde.puntos.filter((_, index) => index !== pointIndex),
        }
      })
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
          const payload = {
        project_info: projectInfo,
        sample_info: sampleInfo,
        test_config: config,
        moldes: activeMoldes.map((molde) => ({
          molde_id: molde.molde_id,
          golpes: Number(molde.golpes),
          diametro_molde_cm: emptyIfBlank(molde.diametro_molde_cm),
          altura_molde_cm: emptyIfBlank(molde.altura_molde_cm),
          peso_molde_g: emptyIfBlank(molde.peso_molde_g),
          peso_molde_mas_muestra_humeda_g: emptyIfBlank(molde.peso_molde_mas_muestra_humeda_g),
          peso_molde_mas_muestra_humeda_saturada_g: emptyIfBlank(molde.peso_molde_mas_muestra_humeda_saturada_g),
          peso_tara_g: emptyIfBlank(molde.peso_tara_g),
          peso_tara_mas_muestra_humeda_g: emptyIfBlank(molde.peso_tara_mas_muestra_humeda_g),
          peso_tara_mas_muestra_seca_g: emptyIfBlank(molde.peso_tara_mas_muestra_seca_g),
          peso_tara_saturada_g: emptyIfBlank(molde.peso_tara_saturada_g),
          peso_tara_mas_muestra_humeda_saturada_g: emptyIfBlank(molde.peso_tara_mas_muestra_humeda_saturada_g),
          peso_tara_mas_muestra_seca_saturada_g: emptyIfBlank(molde.peso_tara_mas_muestra_seca_saturada_g),
          modo_hinchamiento: molde.modo_hinchamiento,
          lectura_hinchamiento_inicial_mm: emptyIfBlank(molde.lectura_hinchamiento_inicial_mm),
          lectura_hinchamiento_final_mm: emptyIfBlank(molde.lectura_hinchamiento_final_mm),
          lectura_hinchamiento_24h_mm: emptyIfBlank(molde.lectura_hinchamiento_24h_mm),
          lectura_hinchamiento_48h_mm: emptyIfBlank(molde.lectura_hinchamiento_48h_mm),
          lectura_hinchamiento_72h_mm: emptyIfBlank(molde.lectura_hinchamiento_72h_mm),
          lectura_hinchamiento_96h_mm: emptyIfBlank(molde.lectura_hinchamiento_96h_mm),
          observaciones: molde.observaciones,
          puntos: molde.puntos.map((point) => ({
            penetracion: Number(point.penetracion),
            carga: Number(point.carga),
          })),
        })),
      }
      const data = await calcularCBR(payload)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Ocurrio un error al procesar el ensayo.')
    } finally {
      setLoading(false)
    }
  }

  const densityChartTraces = useMemo(() => {
    if (!result?.graficas_finales?.densidad_seca_vs_cbr?.length) return []
    const points = result.graficas_finales.densidad_seca_vs_cbr
    return [
      {
        x: points.map((point) => point.densidad_seca_g_cm3),
        y: points.map((point) => point.cbr_final_pct),
        type: 'scatter',
        mode: 'lines+markers+text',
        text: points.map((point) => point.molde_id),
        textposition: 'top center',
        name: 'Densidad seca vs %CBR',
        line: { color: '#7c3aed', width: 3 },
        marker: { size: 10, color: '#7c3aed' },
      },
    ]
  }, [result])

  const reportAssessment = useMemo(
    () => (result ? buildReportAssessment(result) : null),
    [result]
  )

  function handleExportPdf() {
    window.print()
  }

  function handleResetCalculation() {
    setProjectInfo(createInitialProjectInfo())
    setSampleInfo(createInitialSampleInfo())
    setConfig(createInitialConfig())
    setMoldCount(3)
    setMoldes(createInitialMolds())
    setResult(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const reportDate = useMemo(() => {
    if (projectInfo.fecha) return formatDisplayDate(projectInfo.fecha)
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  }, [projectInfo.fecha])

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-brand">
          <AppLogo />
          <div className="hero-copy">
            <span className="eyebrow">GeoServi Lab®</span>
            <h1>GeoCBR Studio</h1>
            <p className="hero-subtitle">Plataforma de cálculo y control para ensayos CBR</p>
            <p>
              El sistema ahora pide dimensiones del molde y datos de peso para calcular
              automaticamente volumen, densidad humeda, humedad y densidad seca, y avisa
              si algun dato no es consistente.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="app-stack">
        <section className="card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Primera etapa</p>
              <h2>Informacion general del proyecto</h2>
            </div>
          </div>
          <div className="form-grid form-grid-3">
            <label>Proyecto<input value={projectInfo.proyecto} onChange={(event) => setProjectInfo({ ...projectInfo, proyecto: event.target.value })} /></label>
            <label>Cliente<input value={projectInfo.cliente} onChange={(event) => setProjectInfo({ ...projectInfo, cliente: event.target.value })} /></label>
            <label>Ubicacion<input value={projectInfo.ubicacion} onChange={(event) => setProjectInfo({ ...projectInfo, ubicacion: event.target.value })} /></label>
            <label>Tramo<input value={projectInfo.tramo} onChange={(event) => setProjectInfo({ ...projectInfo, tramo: event.target.value })} /></label>
            <label>Laboratorio<input value={projectInfo.laboratorio} onChange={(event) => setProjectInfo({ ...projectInfo, laboratorio: event.target.value })} /></label>
            <label>Norma<input value={projectInfo.norma_referencia} onChange={(event) => setProjectInfo({ ...projectInfo, norma_referencia: event.target.value })} /></label>
            <label>Operador<input value={projectInfo.operador} onChange={(event) => setProjectInfo({ ...projectInfo, operador: event.target.value })} /></label>
            <label>Revisor<input value={projectInfo.revisor} onChange={(event) => setProjectInfo({ ...projectInfo, revisor: event.target.value })} /></label>
            <label>Fecha<input type="date" value={projectInfo.fecha} onChange={(event) => setProjectInfo({ ...projectInfo, fecha: event.target.value })} /></label>
          </div>
          <label>Observaciones generales
            <textarea rows={4} value={projectInfo.observaciones} onChange={(event) => setProjectInfo({ ...projectInfo, observaciones: event.target.value })} />
          </label>
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Configuracion del ensayo</p>
              <h2>Muestra, unidades y cantidad de moldes</h2>
            </div>
          </div>
          <div className="form-grid form-grid-3">
            <label>Muestra ID<input value={sampleInfo.muestra_id} onChange={(event) => setSampleInfo({ ...sampleInfo, muestra_id: event.target.value })} /></label>
            <label>Descripcion del material<input value={sampleInfo.descripcion_material} onChange={(event) => setSampleInfo({ ...sampleInfo, descripcion_material: event.target.value })} /></label>
            <label>Procedencia<input value={sampleInfo.procedencia} onChange={(event) => setSampleInfo({ ...sampleInfo, procedencia: event.target.value })} /></label>
            <label>Profundidad<input value={sampleInfo.profundidad} onChange={(event) => setSampleInfo({ ...sampleInfo, profundidad: event.target.value })} /></label>
            <label>Energia de compactacion<input value={sampleInfo.energia_compactacion} onChange={(event) => setSampleInfo({ ...sampleInfo, energia_compactacion: event.target.value })} /></label>
            <label>Condicion de ensayo
              <select value={sampleInfo.condicion_ensayo} onChange={(event) => setSampleInfo({ ...sampleInfo, condicion_ensayo: event.target.value })}>
                <option value="sin_empapar">Sin empapar</option>
                <option value="empapada_4_dias">Despues de empapar 4 dias</option>
                <option value="saturada_en_agua">Saturada en agua</option>
                <option value="natural">Natural</option>
              </select>
            </label>
            <label>Numero de moldes
              <select value={moldCount} onChange={(event) => setMoldCount(Number(event.target.value))}>
                <option value={1}>1 molde</option>
                <option value={2}>2 moldes</option>
                <option value={3}>3 moldes</option>
              </select>
            </label>
            <label>Modo
              <select value={config.modo} onChange={(event) => setConfig({ ...config, modo: event.target.value })}>
                <option value="reporte_completo">Reporte completo</option>
                <option value="solo_grafica">Solo graficar</option>
              </select>
            </label>
            <label>Penetracion de entrada
              <select value={config.unidad_penetracion_entrada} onChange={(event) => setConfig({ ...config, unidad_penetracion_entrada: event.target.value })}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </label>
            <label>Carga de entrada
              <select value={config.unidad_carga_entrada} onChange={(event) => setConfig({ ...config, unidad_carga_entrada: event.target.value })}>
                <option value="kg">kg</option>
                <option value="kN">kN</option>
                <option value="lbf">lbf</option>
              </select>
            </label>
            <label>Penetracion de reporte
              <select value={config.unidad_penetracion_reporte} onChange={(event) => setConfig({ ...config, unidad_penetracion_reporte: event.target.value })}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </label>
            <label>Carga de reporte
              <select value={config.unidad_carga_reporte} onChange={(event) => setConfig({ ...config, unidad_carga_reporte: event.target.value })}>
                <option value="kg">kg</option>
                <option value="kN">kN</option>
                <option value="lbf">lbf</option>
              </select>
            </label>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={config.usar_correccion} onChange={(event) => setConfig({ ...config, usar_correccion: event.target.checked })} />
            Aplicar correccion de origen para la curva inicial segun criterio grafico ASTM
          </label>
        </section>

        <section className="mold-stack">
          {activeMoldes.map((molde, moldIndex) => {
            const preview = moldPreviews[moldIndex]
            const previewCounts = countAlarms(preview.alarms)
            const previewAlertId = `preview-alerts-${moldIndex}`
            return (
              <section className={`card mold-card ${moldToneClass(previewCounts)}`} key={moldIndex}>
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Molde {moldIndex + 1}</p>
                    <h2>{molde.molde_id || `Molde ${moldIndex + 1}`}</h2>
                  </div>
                  <div className="header-pills">
                    <div className="pill">{molde.puntos.length} puntos</div>
                    {previewCounts.warnings === 0 && previewCounts.errors === 0 && (
                      <div className="pill pill-ok">Sin alertas</div>
                    )}
                    {(previewCounts.warnings > 0 || previewCounts.errors > 0) && (
                      <a href={`#${previewAlertId}`} className="pill pill-alert pill-link">
                        {previewCounts.warnings} advertencias | {previewCounts.errors} errores criticos
                      </a>
                    )}
                  </div>
                </div>

                <div className="form-grid form-grid-4">
                  <label>Nombre del molde<input value={molde.molde_id} onChange={(event) => updateMold(moldIndex, 'molde_id', event.target.value)} /></label>
                  <label>Numero de golpes<input type="number" min="1" value={molde.golpes} onChange={(event) => updateMold(moldIndex, 'golpes', event.target.value)} /></label>
                  <label>Diametro del molde (cm)<input type="number" step="any" value={molde.diametro_molde_cm} onChange={(event) => updateMold(moldIndex, 'diametro_molde_cm', event.target.value)} /></label>
                  <label>Altura del molde (cm)<input type="number" step="any" value={molde.altura_molde_cm} onChange={(event) => updateMold(moldIndex, 'altura_molde_cm', event.target.value)} /></label>
                </div>

                <div className="subgrid">
                  <div>
                    <h3>Calculo de volumen y densidad humeda</h3>
                    <div className="form-grid form-grid-3">
                      <label>Peso del molde (g)<input type="number" step="any" value={molde.peso_molde_g} onChange={(event) => updateMold(moldIndex, 'peso_molde_g', event.target.value)} /></label>
                      <label>Peso del molde + muestra humeda (g)<input type="number" step="any" value={molde.peso_molde_mas_muestra_humeda_g} onChange={(event) => updateMold(moldIndex, 'peso_molde_mas_muestra_humeda_g', event.target.value)} /></label>
                      <label>Peso del molde + muestra humeda saturada (g)<input type="number" step="any" value={molde.peso_molde_mas_muestra_humeda_saturada_g} onChange={(event) => updateMold(moldIndex, 'peso_molde_mas_muestra_humeda_saturada_g', event.target.value)} /></label>
                      <label>Observaciones del molde<input value={molde.observaciones} onChange={(event) => updateMold(moldIndex, 'observaciones', event.target.value)} /></label>
                    </div>
                  </div>

                  <div>
                    <h3>Contenido de agua para humedad</h3>
                    <div className="form-grid form-grid-3">
                      <label>Peso de tara (g)<input type="number" step="any" value={molde.peso_tara_g} onChange={(event) => updateMold(moldIndex, 'peso_tara_g', event.target.value)} /></label>
                      <label>Peso humedo + tara (g)<input type="number" step="any" value={molde.peso_tara_mas_muestra_humeda_g} onChange={(event) => updateMold(moldIndex, 'peso_tara_mas_muestra_humeda_g', event.target.value)} /></label>
                      <label>Peso seco + tara (g)<input type="number" step="any" value={molde.peso_tara_mas_muestra_seca_g} onChange={(event) => updateMold(moldIndex, 'peso_tara_mas_muestra_seca_g', event.target.value)} /></label>
                      <label>Tara post-saturacion (g)<input type="number" step="any" value={molde.peso_tara_saturada_g} onChange={(event) => updateMold(moldIndex, 'peso_tara_saturada_g', event.target.value)} /></label>
                      <label>Peso humedo saturado + tara (g)<input type="number" step="any" value={molde.peso_tara_mas_muestra_humeda_saturada_g} onChange={(event) => updateMold(moldIndex, 'peso_tara_mas_muestra_humeda_saturada_g', event.target.value)} /></label>
                      <label>Peso seco saturado + tara (g)<input type="number" step="any" value={molde.peso_tara_mas_muestra_seca_saturada_g} onChange={(event) => updateMold(moldIndex, 'peso_tara_mas_muestra_seca_saturada_g', event.target.value)} /></label>
                    </div>
                  </div>

                  <div>
                    <h3>Hinchamiento durante saturacion</h3>
                    <div className="form-grid form-grid-3">
                      <label>Modo de registro
                        <select value={molde.modo_hinchamiento} onChange={(event) => updateMold(moldIndex, 'modo_hinchamiento', event.target.value)}>
                          <option value="total">Solo total acumulado</option>
                          <option value="cada_24_horas">Lecturas cada 24 horas</option>
                        </select>
                      </label>
                      <label>Lectura inicial de hinchamiento (mm)<input type="number" step="any" value={molde.lectura_hinchamiento_inicial_mm} onChange={(event) => updateMold(moldIndex, 'lectura_hinchamiento_inicial_mm', event.target.value)} /></label>
                      <label>Lectura final total (mm)<input type="number" step="any" value={molde.lectura_hinchamiento_final_mm} onChange={(event) => updateMold(moldIndex, 'lectura_hinchamiento_final_mm', event.target.value)} /></label>
                      {molde.modo_hinchamiento === 'cada_24_horas' && (
                        <>
                          <label>Lectura a 24 h (mm)<input type="number" step="any" value={molde.lectura_hinchamiento_24h_mm} onChange={(event) => updateMold(moldIndex, 'lectura_hinchamiento_24h_mm', event.target.value)} /></label>
                          <label>Lectura a 48 h (mm)<input type="number" step="any" value={molde.lectura_hinchamiento_48h_mm} onChange={(event) => updateMold(moldIndex, 'lectura_hinchamiento_48h_mm', event.target.value)} /></label>
                          <label>Lectura a 72 h (mm)<input type="number" step="any" value={molde.lectura_hinchamiento_72h_mm} onChange={(event) => updateMold(moldIndex, 'lectura_hinchamiento_72h_mm', event.target.value)} /></label>
                          <label>Lectura a 96 h (mm)<input type="number" step="any" value={molde.lectura_hinchamiento_96h_mm} onChange={(event) => updateMold(moldIndex, 'lectura_hinchamiento_96h_mm', event.target.value)} /></label>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="auto-calc-block">
                  <div className="section-head compact-head">
                    <div>
                      <h3>Calculos automaticos del molde</h3>
                      <p>Se actualizan con los datos que vas ingresando.</p>
                    </div>
                  </div>
                  {!!preview.alarms.length && (
                    <div className="alarm-stack" id={previewAlertId}>
                      {preview.alarms.map((item, index) => (
                        <div key={index} className={`alert-box alert-${classifyAlarm(item)}`}>
                          <span className="alert-badge">{alarmLabel(classifyAlarm(item))}</span>
                          <p>{item}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="summary-grid mold-preview-grid">
                    <div className="summary-item summary-strong">
                      <span>Volumen calculado</span>
                      <strong>{preview.volumen != null ? `${preview.volumen} cm3` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Volumen post-saturacion</span>
                      <strong>{preview.volumenSaturado != null ? `${preview.volumenSaturado} cm3` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Masa muestra humeda</span>
                      <strong>{preview.masaHumeda != null ? `${preview.masaHumeda} g` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Masa humeda saturada</span>
                      <strong>{preview.masaHumedaSaturada != null ? `${preview.masaHumedaSaturada} g` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Humedad calculada</span>
                      <strong>{preview.humedad != null ? `${preview.humedad} %` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Humedad post-saturacion</span>
                      <strong>{preview.humedadSaturada != null ? `${preview.humedadSaturada} %` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Densidad humeda</span>
                      <strong>{preview.densidadHumeda != null ? `${preview.densidadHumeda} g/cm3` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Densidad seca</span>
                      <strong>{preview.densidadSeca != null ? `${preview.densidadSeca} g/cm3` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Densidad humeda post-saturacion</span>
                      <strong>{preview.densidadHumedaSaturada != null ? `${preview.densidadHumedaSaturada} g/cm3` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item summary-strong">
                      <span>Densidad seca post-saturacion</span>
                      <strong>{preview.densidadSecaSaturada != null ? `${preview.densidadSecaSaturada} g/cm3` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Hinchamiento final</span>
                      <strong>{preview.hinchamiento != null ? `${preview.hinchamiento} %` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Delta de hinchamiento</span>
                      <strong>{preview.deltaHinchamientoMm != null ? `${preview.deltaHinchamientoMm} mm` : 'Pendiente'}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Lectura final usada</span>
                      <strong>{preview.lecturaFinalUtilizada != null ? `${preview.lecturaFinalUtilizada} mm` : 'Pendiente'}</strong>
                    </div>
                  </div>
                  {preview.modoHinchamiento === 'cada_24_horas' && (
                    <div className="summary-grid mold-preview-grid">
                      {preview.hinchamientoPorLectura.map((reading) => (
                        <div className="summary-item" key={`${molde.molde_id}-${reading.label}`}>
                          <span>Hinchamiento {reading.label}</span>
                          <strong>{reading.porcentaje != null ? `${reading.porcentaje} %` : 'Pendiente'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="table-head">
                  <div>
                    <h3>Resultados de penetracion y carga</h3>
                    <p>Usa las unidades de entrada seleccionadas para capturar la curva de cada molde.</p>
                  </div>
                  <button type="button" onClick={() => addPointRow(moldIndex)}>Agregar fila</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Penetracion ({config.unidad_penetracion_entrada})</th>
                        <th>Carga ({config.unidad_carga_entrada})</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {molde.puntos.map((point, pointIndex) => (
                        <tr key={pointIndex}>
                          <td>{pointIndex + 1}</td>
                          <td><input type="number" step="any" value={point.penetracion} onChange={(event) => updatePoint(moldIndex, pointIndex, 'penetracion', event.target.value)} /></td>
                          <td><input type="number" step="any" value={point.carga} onChange={(event) => updatePoint(moldIndex, pointIndex, 'carga', event.target.value)} /></td>
                          <td><button type="button" onClick={() => removePointRow(moldIndex, pointIndex)} disabled={molde.puntos.length <= 3}>Eliminar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </section>

        <section className="submit-row">
          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Procesando ensayo...' : 'Procesar ensayo CBR'}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      </form>

      {result && (
        <section className="results report-sheet">
          <div className="report-watermark" aria-hidden="true">GeoCBR Studio</div>
          <div className="card export-banner print-banner">
            <div className="report-head">
              <div className="print-brand">
              <AppLogo />
              <div>
                <p className="section-kicker">GeoServi Lab®</p>
                <h2>GeoCBR Studio</h2>
                <p className="print-copy">Reporte tecnico profesional de ensayo CBR para revision, archivo y exportacion.</p>
              </div>
              </div>
              <div className="report-meta-grid">
              <div className="report-meta-item">
                <span>Proyecto</span>
                <strong>{result.project_info?.proyecto || 'No especificado'}</strong>
              </div>
              <div className="report-meta-item">
                <span>Muestra</span>
                <strong>{result.sample_info?.muestra_id || 'No especificada'}</strong>
              </div>
              <div className="report-meta-item">
                <span>Fecha del reporte</span>
                <strong>{reportDate}</strong>
              </div>
              <div className="report-meta-item">
                <span>Norma</span>
                <strong>{result.project_info?.norma_referencia || 'ASTM D1883'}</strong>
              </div>
            </div>
            </div>
            <div className="header-pills no-print">
              <button type="button" className="secondary-action" onClick={handleResetCalculation}>
                Iniciar otro calculo
              </button>
              <button type="button" className="primary-action" onClick={handleExportPdf}>
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="card report-section">
            <div className="section-head">
              <div>
                <p className="section-kicker">Resumen ejecutivo</p>
                <h2>Resultado general del ensayo</h2>
              </div>
            </div>
            {result.resumen_general.hay_errores_validacion && (
              <div className="error-box">
                Existen moldes con datos inconsistentes. Revisa los avisos mostrados en cada molde.
              </div>
            )}
            <div className="report-meta-grid report-meta-grid-wide">
              <div className="report-meta-item">
                <span>Cliente</span>
                <strong>{result.project_info?.cliente || 'No especificado'}</strong>
              </div>
              <div className="report-meta-item">
                <span>Ubicacion</span>
                <strong>{result.project_info?.ubicacion || 'No especificada'}</strong>
              </div>
              <div className="report-meta-item">
                <span>Procedencia</span>
                <strong>{result.sample_info?.procedencia || 'No especificada'}</strong>
              </div>
              <div className="report-meta-item">
                <span>Condicion de ensayo</span>
                <strong>{formatConditionLabel(result.sample_info?.condicion_ensayo)}</strong>
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-item">
                <span>Moldes procesados</span>
                <strong>{result.resumen_general.cantidad_moldes}</strong>
              </div>
              <div className="summary-item">
                <span>CBR maximo</span>
                <strong>{result.resumen_general.cbr_maximo_pct} %</strong>
              </div>
              <div className="summary-item">
                <span>CBR minimo</span>
                <strong>{result.resumen_general.cbr_minimo_pct} %</strong>
              </div>
              <div className="summary-item">
                <span>Densidad seca maxima</span>
                <strong>{result.resumen_general.densidad_seca_maxima_g_cm3 ?? 'No disponible'}</strong>
              </div>
            </div>
          </div>

          {result.moldes.map((molde, index) => (
            <section className="result-block report-section" key={molde.molde_id}>
              {(() => {
                const resultCounts = countAlarms(molde.errores_validacion || [])
                const resultAlertId = `result-alerts-${molde.molde_id.replaceAll(' ', '-').toLowerCase()}`
                return (
                  <div className={`card result-overview ${moldToneClass(resultCounts)}`}>
                    <div className="section-head">
                      <div>
                        <p className="section-kicker">Resumen del molde {index + 1}</p>
                        <h2>{molde.molde_id}</h2>
                      </div>
                      <div className="header-pills">
                        <div className="pill">{molde.golpes} golpes</div>
                        {resultCounts.warnings === 0 && resultCounts.errors === 0 && (
                          <div className="pill pill-ok">Sin alertas</div>
                        )}
                        {(resultCounts.warnings > 0 || resultCounts.errors > 0) && (
                          <a href={`#${resultAlertId}`} className="pill pill-alert pill-link">
                            {resultCounts.warnings} advertencias | {resultCounts.errors} errores criticos
                          </a>
                        )}
                      </div>
                    </div>
                    {!!molde.errores_validacion?.length && (
                      <div className="alarm-stack" id={resultAlertId}>
                        {molde.errores_validacion.map((item, index) => (
                          <div key={index} className={`alert-box alert-${classifyAlarm(item)}`}>
                            <span className="alert-badge">{alarmLabel(classifyAlarm(item))}</span>
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mini-meta">
                      <p><strong>Correccion:</strong> {molde.nota_correccion}</p>
                      <p><strong>Desplazamiento de origen:</strong> {molde.desplazamiento_origen_mm} mm</p>
                    </div>
                    <div className="summary-grid">
                      {moldSummaryCards(molde).map(([label, value]) => (
                        <div className="summary-item" key={`${molde.molde_id}-summary-${label}`}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    {molde.lecturas?.modo_hinchamiento === 'cada_24_horas' && (
                      <div className="summary-grid">
                        {Object.entries(molde.lecturas?.hinchamiento_cada_24_horas_pct || {}).map(([label, value]) => (
                          <div className="summary-item" key={`${molde.molde_id}-${label}`}>
                            <span>Hinchamiento {label}</span>
                            <strong>{value != null ? `${value} %` : 'Pendiente'}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="card">
                <div className="section-head">
                  <div>
                    <p className="section-kicker">Resultados de carga</p>
                    <h3>Resultados de penetracion, carga y curva del molde</h3>
                  </div>
                </div>
                {molde.resultados && (
                  <div className="summary-grid">
                    {moldResultCards(molde).map(([label, value]) => (
                      <div className="summary-item" key={`${molde.molde_id}-${label}`}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ChartCBR
                titulo={`Relacion deformacion - carga | ${molde.molde_id}`}
                traces={buildCurveTraces(molde)}
                xTitle={`Penetracion (${result.test_config.unidad_penetracion_reporte})`}
                yTitle={`Carga (${result.test_config.unidad_carga_reporte})`}
              />

              <div className="card">
                <h3>Tabla procesada del molde</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Penetracion original</th>
                        <th>Penetracion corregida</th>
                        <th>Carga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {molde.tabla_procesada.map((row, index) => (
                        <tr key={index}>
                          <td>{row.penetracion_original}</td>
                          <td>{row.penetracion_corregida}</td>
                          <td>{row.carga}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}

          <section className="card report-section">
            <div className="section-head">
              <div>
                <p className="section-kicker">Resultado final</p>
                <h2>Grafico final, conclusion y recomendacion</h2>
              </div>
            </div>
            {!!densityChartTraces.length && (
              <ChartCBR
                titulo="Relacion final densidad seca - %CBR"
                traces={densityChartTraces}
                xTitle="Densidad seca (g/cm3)"
                yTitle="% CBR"
              />
            )}
            {reportAssessment && (
              <div className="report-conclusion-grid">
                <div className="summary-item summary-strong">
                  <span>Clasificacion tecnica</span>
                  <strong>{reportAssessment.classification}</strong>
                </div>
                <div className="summary-item summary-strong">
                  <span>Conclusion tecnica</span>
                  <strong>{reportAssessment.conclusion}</strong>
                </div>
                <div className="summary-item">
                  <span>Recomendacion</span>
                  <strong>{reportAssessment.recommendation}</strong>
                </div>
              </div>
            )}
          </section>
          <footer className="report-footer">
            <p>GeoServi Lab® | GeoCBR Studio | Reporte tecnico de ensayo CBR</p>
            <p>Documento con marca de agua para uso interno y profesional. Todos los derechos reservados.</p>
          </footer>
        </section>
      )}
    </div>
  )
}
