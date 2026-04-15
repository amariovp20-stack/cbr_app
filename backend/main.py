from __future__ import annotations

from math import pi
from typing import Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="CBR Report API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STANDARD_LOADS_KG = {
    2.54: 1370.0,
    5.08: 2055.0,
}

PENETRATION_TO_MM = {
    "mm": 1.0,
    "cm": 10.0,
    "in": 25.4,
}

LOAD_TO_KG = {
    "kg": 1.0,
    "kN": 101.97162,
    "lbf": 0.45359237,
}


class ProjectInfo(BaseModel):
    proyecto: str = ""
    cliente: str = ""
    ubicacion: str = ""
    tramo: str = ""
    laboratorio: str = ""
    norma_referencia: str = "ASTM D1883"
    operador: str = ""
    revisor: str = ""
    fecha: str = ""
    observaciones: str = ""


class SampleInfo(BaseModel):
    muestra_id: str = ""
    descripcion_material: str = ""
    procedencia: str = ""
    profundidad: str = ""
    energia_compactacion: str = ""
    condicion_ensayo: str = "sin_empapar"


class TestConfig(BaseModel):
    modo: Literal["reporte_completo", "solo_grafica"] = "reporte_completo"
    usar_correccion: bool = True
    unidad_penetracion_entrada: Literal["mm", "cm", "in"] = "mm"
    unidad_carga_entrada: Literal["kg", "kN", "lbf"] = "kg"
    unidad_penetracion_reporte: Literal["mm", "cm", "in"] = "mm"
    unidad_carga_reporte: Literal["kg", "kN", "lbf"] = "kg"


class Point(BaseModel):
    penetracion: float = Field(..., ge=0)
    carga: float = Field(..., ge=0)


class MoldInput(BaseModel):
    molde_id: str = Field(..., min_length=1)
    golpes: int = Field(..., ge=1)
    diametro_molde_cm: Optional[float] = Field(default=None, gt=0)
    altura_molde_cm: Optional[float] = Field(default=None, gt=0)
    peso_molde_g: Optional[float] = Field(default=None, ge=0)
    peso_molde_mas_muestra_humeda_g: Optional[float] = Field(default=None, ge=0)
    peso_molde_mas_muestra_humeda_saturada_g: Optional[float] = Field(default=None, ge=0)
    peso_tara_g: Optional[float] = Field(default=None, ge=0)
    peso_tara_mas_muestra_humeda_g: Optional[float] = Field(default=None, ge=0)
    peso_tara_mas_muestra_seca_g: Optional[float] = Field(default=None, ge=0)
    peso_tara_saturada_g: Optional[float] = Field(default=None, ge=0)
    peso_tara_mas_muestra_humeda_saturada_g: Optional[float] = Field(default=None, ge=0)
    peso_tara_mas_muestra_seca_saturada_g: Optional[float] = Field(default=None, ge=0)
    modo_hinchamiento: Literal["total", "cada_24_horas"] = "total"
    lectura_hinchamiento_inicial_mm: Optional[float] = Field(default=None, ge=0)
    lectura_hinchamiento_final_mm: Optional[float] = Field(default=None, ge=0)
    lectura_hinchamiento_24h_mm: Optional[float] = Field(default=None, ge=0)
    lectura_hinchamiento_48h_mm: Optional[float] = Field(default=None, ge=0)
    lectura_hinchamiento_72h_mm: Optional[float] = Field(default=None, ge=0)
    lectura_hinchamiento_96h_mm: Optional[float] = Field(default=None, ge=0)
    observaciones: str = ""
    puntos: list[Point] = Field(..., min_length=3)

    @model_validator(mode="after")
    def validate_points(self):
        penetraciones = [p.penetracion for p in self.puntos]
        if penetraciones != sorted(penetraciones):
            raise ValueError("Los puntos de cada molde deben estar ordenados por penetracion ascendente.")
        if len(set(penetraciones)) != len(penetraciones):
            raise ValueError("No se permiten penetraciones repetidas dentro de un mismo molde.")
        return self


class CBRInput(BaseModel):
    project_info: ProjectInfo = Field(default_factory=ProjectInfo)
    sample_info: SampleInfo = Field(default_factory=SampleInfo)
    test_config: TestConfig = Field(default_factory=TestConfig)
    moldes: list[MoldInput] = Field(..., min_length=1, max_length=3)


def convert_penetration_to_mm(value: float, unit: str) -> float:
    return value * PENETRATION_TO_MM[unit]


def convert_mm_to_unit(value_mm: float, unit: str) -> float:
    return value_mm / PENETRATION_TO_MM[unit]


def convert_load_to_kg(value: float, unit: str) -> float:
    return value * LOAD_TO_KG[unit]


def convert_kg_to_unit(value_kg: float, unit: str) -> float:
    return value_kg / LOAD_TO_KG[unit]


def round_or_none(value: Optional[float], digits: int = 4) -> Optional[float]:
    if value is None:
        return None
    return round(value, digits)


def derive_volume_cm3(diameter_cm: Optional[float], height_cm: Optional[float]) -> Optional[float]:
    if diameter_cm is None or height_cm is None:
        return None
    radius_cm = diameter_cm / 2.0
    return pi * (radius_cm**2) * height_cm


def derive_wet_sample_mass_g(
    mold_weight_g: Optional[float],
    mold_plus_wet_weight_g: Optional[float],
    errors: list[str],
) -> Optional[float]:
    if mold_weight_g is None or mold_plus_wet_weight_g is None:
        return None
    if mold_plus_wet_weight_g <= mold_weight_g:
        errors.append("El peso del molde mas muestra humeda debe ser mayor que el peso del molde.")
        return None
    return mold_plus_wet_weight_g - mold_weight_g


def derive_water_content_pct(
    tare_weight_g: Optional[float],
    tare_plus_wet_g: Optional[float],
    tare_plus_dry_g: Optional[float],
    errors: list[str],
) -> tuple[Optional[float], Optional[float], Optional[float]]:
    if tare_weight_g is None or tare_plus_wet_g is None or tare_plus_dry_g is None:
        return None, None, None
    if tare_plus_wet_g <= tare_weight_g:
        errors.append("El peso humedo + tara debe ser mayor que el peso de tara.")
        return None, None, None
    if tare_plus_dry_g <= tare_weight_g:
        errors.append("El peso seco + tara debe ser mayor que el peso de tara.")
        return None, None, None
    wet_soil_g = tare_plus_wet_g - tare_weight_g
    dry_soil_g = tare_plus_dry_g - tare_weight_g
    if wet_soil_g <= dry_soil_g:
        errors.append("La muestra humeda de contenido de agua debe pesar mas que la muestra seca.")
        return wet_soil_g, dry_soil_g, None
    if dry_soil_g <= 0:
        errors.append("La muestra seca usada para contenido de agua debe ser mayor que cero.")
        return wet_soil_g, dry_soil_g, None
    humidity_pct = ((wet_soil_g - dry_soil_g) / dry_soil_g) * 100.0
    return wet_soil_g, dry_soil_g, humidity_pct


def derive_density_wet_g_cm3(
    wet_sample_mass_g: Optional[float],
    volume_cm3: Optional[float],
    errors: list[str],
) -> Optional[float]:
    if wet_sample_mass_g is None or volume_cm3 is None:
        return None
    if volume_cm3 <= 0:
        errors.append("El volumen del molde debe ser mayor que cero.")
        return None
    return wet_sample_mass_g / volume_cm3


def derive_density_dry_g_cm3(
    density_wet_g_cm3: Optional[float],
    water_content_pct: Optional[float],
) -> Optional[float]:
    if density_wet_g_cm3 is None or water_content_pct is None:
        return None
    return density_wet_g_cm3 / (1 + (water_content_pct / 100.0))


def derive_swell_pct(initial_mm: Optional[float], final_mm: Optional[float], height_cm: Optional[float]) -> Optional[float]:
    if initial_mm is None or final_mm is None or height_cm in (None, 0):
        return None
    height_mm = height_cm * 10.0
    return max(0.0, ((final_mm - initial_mm) / height_mm) * 100.0)


def derive_swell_detail(molde: MoldInput, errors: list[str]) -> dict:
    readings = {
        "24h": molde.lectura_hinchamiento_24h_mm,
        "48h": molde.lectura_hinchamiento_48h_mm,
        "72h": molde.lectura_hinchamiento_72h_mm,
        "96h": molde.lectura_hinchamiento_96h_mm,
    }

    final_reading_mm = molde.lectura_hinchamiento_final_mm
    if molde.modo_hinchamiento == "cada_24_horas":
        interval_values = [value for value in readings.values() if value is not None]
        if interval_values:
            final_reading_mm = interval_values[-1]
        elif final_reading_mm is None:
            errors.append("Debe ingresar al menos una lectura de hinchamiento cada 24 horas o la lectura total final.")

    interval_percentages = {}
    for label, reading in readings.items():
        interval_percentages[label] = round_or_none(
            derive_swell_pct(molde.lectura_hinchamiento_inicial_mm, reading, molde.altura_molde_cm)
        )

    total_pct = derive_swell_pct(
        molde.lectura_hinchamiento_inicial_mm,
        final_reading_mm,
        molde.altura_molde_cm,
    )

    return {
        "modo_hinchamiento": molde.modo_hinchamiento,
        "lectura_inicial_mm": round_or_none(molde.lectura_hinchamiento_inicial_mm),
        "lectura_final_utilizada_mm": round_or_none(final_reading_mm),
        "delta_hinchamiento_mm": round_or_none(
            None
            if molde.lectura_hinchamiento_inicial_mm is None or final_reading_mm is None
            else max(0.0, final_reading_mm - molde.lectura_hinchamiento_inicial_mm)
        ),
        "lecturas_cada_24_horas_mm": {label: round_or_none(value) for label, value in readings.items()},
        "hinchamiento_cada_24_horas_pct": interval_percentages,
        "hinchamiento_total_pct": round_or_none(total_pct),
    }


def derive_saturated_volume_cm3(
    base_volume_cm3: Optional[float],
    initial_height_cm: Optional[float],
    swell_delta_mm: Optional[float],
    errors: list[str],
) -> Optional[float]:
    if base_volume_cm3 is None or initial_height_cm is None or swell_delta_mm is None:
        return None
    if initial_height_cm <= 0:
        errors.append("La altura inicial del molde debe ser mayor que cero para calcular el volumen post-saturacion.")
        return None
    saturated_height_cm = initial_height_cm + (swell_delta_mm / 10.0)
    if saturated_height_cm <= 0:
        errors.append("La altura post-saturacion calculada no es valida.")
        return None
    return base_volume_cm3 * (saturated_height_cm / initial_height_cm)


def append_control_alarms(
    volume_cm3: Optional[float],
    water_content_pct: Optional[float],
    density_wet_g_cm3: Optional[float],
    density_dry_g_cm3: Optional[float],
    swell_pct: Optional[float],
    errors: list[str],
):
    if volume_cm3 is not None and (volume_cm3 < 2000 or volume_cm3 > 2300):
        errors.append(
            f"Alarma: el volumen calculado del molde es {volume_cm3:.4f} cm3 y esta fuera del rango tipico de control para CBR."
        )
    if water_content_pct is not None and (water_content_pct < 0 or water_content_pct > 60):
        errors.append(
            f"Alarma: la humedad calculada es {water_content_pct:.4f} % y esta fuera de parametros razonables de control."
        )
    if density_wet_g_cm3 is not None and (density_wet_g_cm3 < 1.2 or density_wet_g_cm3 > 2.4):
        errors.append(
            f"Alarma: la densidad humeda calculada es {density_wet_g_cm3:.4f} g/cm3 y esta fuera del rango usual de control."
        )
    if density_dry_g_cm3 is not None and (density_dry_g_cm3 < 1.0 or density_dry_g_cm3 > 2.3):
        errors.append(
            f"Alarma: la densidad seca calculada es {density_dry_g_cm3:.4f} g/cm3 y esta fuera del rango usual de control."
        )
    if swell_pct is not None and swell_pct > 5:
        errors.append(
            f"Alarma: el hinchamiento calculado es {swell_pct:.4f} % y supera 5%; revise las lecturas del molde."
        )


def interpolate(points: list[Point], x_mm: float) -> float:
    for point in points:
        if abs(point.penetracion - x_mm) < 1e-9:
            return point.carga

    for index in range(len(points) - 1):
        x1 = points[index].penetracion
        x2 = points[index + 1].penetracion
        if x1 <= x_mm <= x2:
            y1 = points[index].carga
            y2 = points[index + 1].carga
            if abs(x2 - x1) < 1e-9:
                return y1
            return y1 + (y2 - y1) * ((x_mm - x1) / (x2 - x1))

    raise ValueError(f"No es posible interpolar en {x_mm:.3f} mm. Verifique el rango de datos.")


def detect_origin_correction(points: list[Point]) -> tuple[float, bool, str, Optional[dict]]:
    if len(points) < 3:
        return 0.0, False, "Sin correccion: se requieren al menos 3 puntos.", None

    max_segments = min(4, len(points) - 1)
    segments: list[dict] = []
    for index in range(max_segments):
        p1 = points[index]
        p2 = points[index + 1]
        delta_x = p2.penetracion - p1.penetracion
        if delta_x <= 0:
            continue
        slope = (p2.carga - p1.carga) / delta_x
        segments.append(
            {
                "index": index,
                "slope": slope,
                "x1": p1.penetracion,
                "y1": p1.carga,
                "x2": p2.penetracion,
                "y2": p2.carga,
            }
        )

    if len(segments) < 2:
        return 0.0, False, "Sin correccion: no hay segmentos suficientes para evaluar la curva inicial.", None

    steepest = max(segments, key=lambda item: item["slope"])
    first = segments[0]
    if steepest["index"] == 0 or steepest["slope"] <= first["slope"] * 1.05:
        return 0.0, False, "Sin correccion: la curva inicial no muestra asiento significativo.", None

    slope = steepest["slope"]
    if slope <= 0:
        return 0.0, False, "Sin correccion: la pendiente del tramo seleccionado no es positiva.", None

    intercept_x = steepest["x1"] - (steepest["y1"] / slope)
    offset = max(0.0, intercept_x)
    if offset <= 0:
        return 0.0, False, "Sin correccion: la extrapolacion no desplaza el origen.", None

    line_end_x = max(point.penetracion for point in points)
    line = {
        "x_inicial_mm": round(offset, 4),
        "y_inicial_kg": 0.0,
        "x_final_mm": round(line_end_x, 4),
        "y_final_kg": round((line_end_x - offset) * slope, 4),
        "pendiente_kg_mm": round(slope, 4),
    }
    note = (
        "Se aplico correccion de origen con base en la tangente del tramo mas recto e inclinado "
        "de la parte inicial, siguiendo el criterio grafico habitual de ASTM D1883."
    )
    return offset, True, note, line


def convert_points_for_chart(points: list[Point], penetration_unit: str, load_unit: str) -> list[dict]:
    return [
        {
            "penetracion": round(convert_mm_to_unit(point.penetracion, penetration_unit), 4),
            "carga": round(convert_kg_to_unit(point.carga, load_unit), 4),
        }
        for point in points
    ]


def build_processed_table(
    original_points: list[Point],
    corrected_points: list[Point],
    penetration_unit: str,
    load_unit: str,
) -> list[dict]:
    return [
        {
            "penetracion_original": round(convert_mm_to_unit(original.penetracion, penetration_unit), 4),
            "penetracion_corregida": round(convert_mm_to_unit(corrected.penetracion, penetration_unit), 4),
            "carga": round(convert_kg_to_unit(original.carga, load_unit), 4),
        }
        for original, corrected in zip(original_points, corrected_points)
    ]


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/cbr/calculate")
def calculate(data: CBRInput):
    entry_penetration_unit = data.test_config.unidad_penetracion_entrada
    entry_load_unit = data.test_config.unidad_carga_entrada
    report_penetration_unit = data.test_config.unidad_penetracion_reporte
    report_load_unit = data.test_config.unidad_carga_reporte

    mold_results = []
    density_vs_cbr = []

    for molde in data.moldes:
        errors: list[str] = []
        normalized_points = [
            Point(
                penetracion=convert_penetration_to_mm(point.penetracion, entry_penetration_unit),
                carga=convert_load_to_kg(point.carga, entry_load_unit),
            )
            for point in molde.puntos
        ]

        offset_mm = 0.0
        correction_line = None
        correction_note = "Correccion desactivada por el usuario."
        correction_applied = False
        if data.test_config.usar_correccion:
            offset_mm, correction_applied, correction_note, correction_line = detect_origin_correction(normalized_points)

        corrected = [
            Point(penetracion=max(0.0, point.penetracion - offset_mm), carga=point.carga)
            for point in normalized_points
        ]

        carga_254_kg = interpolate(corrected, 2.54)
        carga_508_kg = interpolate(corrected, 5.08)
        cbr_254 = (carga_254_kg / STANDARD_LOADS_KG[2.54]) * 100.0
        cbr_508 = (carga_508_kg / STANDARD_LOADS_KG[5.08]) * 100.0
        cbr_final = max(cbr_254, cbr_508)
        penetration_governing_mm = 2.54 if cbr_254 >= cbr_508 else 5.08

        volume_cm3 = derive_volume_cm3(molde.diametro_molde_cm, molde.altura_molde_cm)
        wet_sample_mass_g = derive_wet_sample_mass_g(
            molde.peso_molde_g,
            molde.peso_molde_mas_muestra_humeda_g,
            errors,
        )
        wet_sample_mass_saturated_g = derive_wet_sample_mass_g(
            molde.peso_molde_g,
            molde.peso_molde_mas_muestra_humeda_saturada_g,
            errors,
        )
        water_wet_g, water_dry_g, water_content_pct = derive_water_content_pct(
            molde.peso_tara_g,
            molde.peso_tara_mas_muestra_humeda_g,
            molde.peso_tara_mas_muestra_seca_g,
            errors,
        )
        water_wet_saturated_g, water_dry_saturated_g, water_content_saturated_pct = derive_water_content_pct(
            molde.peso_tara_saturada_g,
            molde.peso_tara_mas_muestra_humeda_saturada_g,
            molde.peso_tara_mas_muestra_seca_saturada_g,
            errors,
        )
        density_wet_g_cm3 = derive_density_wet_g_cm3(wet_sample_mass_g, volume_cm3, errors)
        density_dry_g_cm3 = derive_density_dry_g_cm3(density_wet_g_cm3, water_content_pct)
        swell_detail = derive_swell_detail(molde, errors)
        swell_pct = swell_detail["hinchamiento_total_pct"]
        saturated_volume_cm3 = derive_saturated_volume_cm3(
            volume_cm3,
            molde.altura_molde_cm,
            swell_detail["delta_hinchamiento_mm"],
            errors,
        )
        density_wet_saturated_g_cm3 = derive_density_wet_g_cm3(
            wet_sample_mass_saturated_g,
            saturated_volume_cm3,
            errors,
        )
        density_dry_saturated_g_cm3 = derive_density_dry_g_cm3(
            density_wet_saturated_g_cm3,
            water_content_saturated_pct,
        )
        append_control_alarms(
            volume_cm3,
            water_content_pct,
            density_wet_g_cm3,
            density_dry_g_cm3,
            swell_pct,
            errors,
        )
        append_control_alarms(
            saturated_volume_cm3,
            water_content_saturated_pct,
            density_wet_saturated_g_cm3,
            density_dry_saturated_g_cm3,
            None,
            errors,
        )

        density_for_chart = density_dry_saturated_g_cm3 if density_dry_saturated_g_cm3 is not None else density_dry_g_cm3
        if density_for_chart is not None:
            density_vs_cbr.append(
                {
                    "molde_id": molde.molde_id,
                    "densidad_seca_g_cm3": round(density_for_chart, 4),
                    "cbr_final_pct": round(cbr_final, 4),
                }
            )

        chart_original = convert_points_for_chart(normalized_points, report_penetration_unit, report_load_unit)
        chart_corrected = convert_points_for_chart(corrected, report_penetration_unit, report_load_unit)

        chart_correction_line = []
        if correction_line:
            chart_correction_line = [
                {
                    "penetracion": round(convert_mm_to_unit(correction_line["x_inicial_mm"], report_penetration_unit), 4),
                    "carga": round(convert_kg_to_unit(correction_line["y_inicial_kg"], report_load_unit), 4),
                },
                {
                    "penetracion": round(convert_mm_to_unit(correction_line["x_final_mm"], report_penetration_unit), 4),
                    "carga": round(convert_kg_to_unit(correction_line["y_final_kg"], report_load_unit), 4),
                },
            ]

        references = [
            {
                "penetracion": round(convert_mm_to_unit(2.54, report_penetration_unit), 4),
                "carga": round(convert_kg_to_unit(STANDARD_LOADS_KG[2.54], report_load_unit), 4),
                "etiqueta": f"2.54 mm ({convert_mm_to_unit(2.54, report_penetration_unit):.3f} {report_penetration_unit})",
            },
            {
                "penetracion": round(convert_mm_to_unit(5.08, report_penetration_unit), 4),
                "carga": round(convert_kg_to_unit(STANDARD_LOADS_KG[5.08], report_load_unit), 4),
                "etiqueta": f"5.08 mm ({convert_mm_to_unit(5.08, report_penetration_unit):.3f} {report_penetration_unit})",
            },
        ]

        mold_results.append(
            {
                "molde_id": molde.molde_id,
                "golpes": molde.golpes,
                "observaciones": molde.observaciones,
                "errores_validacion": errors,
                "correccion_aplicada": correction_applied,
                "desplazamiento_origen_mm": round(offset_mm, 4),
                "nota_correccion": correction_note,
                "lecturas": {
                    "diametro_molde_cm": round_or_none(molde.diametro_molde_cm),
                    "altura_molde_cm": round_or_none(molde.altura_molde_cm),
                    "volumen_molde_cm3": round_or_none(volume_cm3),
                    "peso_molde_g": round_or_none(molde.peso_molde_g),
                    "peso_molde_mas_muestra_humeda_g": round_or_none(molde.peso_molde_mas_muestra_humeda_g),
                    "masa_muestra_humeda_g": round_or_none(wet_sample_mass_g),
                    "peso_molde_mas_muestra_humeda_saturada_g": round_or_none(molde.peso_molde_mas_muestra_humeda_saturada_g),
                    "masa_muestra_humeda_saturada_g": round_or_none(wet_sample_mass_saturated_g),
                    "peso_tara_g": round_or_none(molde.peso_tara_g),
                    "peso_tara_mas_muestra_humeda_g": round_or_none(molde.peso_tara_mas_muestra_humeda_g),
                    "peso_tara_mas_muestra_seca_g": round_or_none(molde.peso_tara_mas_muestra_seca_g),
                    "masa_humeda_contenido_agua_g": round_or_none(water_wet_g),
                    "masa_seca_contenido_agua_g": round_or_none(water_dry_g),
                    "humedad_porcentaje": round_or_none(water_content_pct),
                    "peso_tara_saturada_g": round_or_none(molde.peso_tara_saturada_g),
                    "peso_tara_mas_muestra_humeda_saturada_g": round_or_none(molde.peso_tara_mas_muestra_humeda_saturada_g),
                    "peso_tara_mas_muestra_seca_saturada_g": round_or_none(molde.peso_tara_mas_muestra_seca_saturada_g),
                    "masa_humeda_contenido_agua_saturada_g": round_or_none(water_wet_saturated_g),
                    "masa_seca_contenido_agua_saturada_g": round_or_none(water_dry_saturated_g),
                    "humedad_saturada_porcentaje": round_or_none(water_content_saturated_pct),
                    "densidad_humeda_g_cm3": round_or_none(density_wet_g_cm3),
                    "densidad_seca_g_cm3": round_or_none(density_dry_g_cm3),
                    "volumen_post_saturacion_cm3": round_or_none(saturated_volume_cm3),
                    "densidad_humeda_saturada_g_cm3": round_or_none(density_wet_saturated_g_cm3),
                    "densidad_seca_saturada_g_cm3": round_or_none(density_dry_saturated_g_cm3),
                    "modo_hinchamiento": molde.modo_hinchamiento,
                    "lectura_hinchamiento_inicial_mm": round_or_none(molde.lectura_hinchamiento_inicial_mm),
                    "lectura_hinchamiento_final_mm": round_or_none(molde.lectura_hinchamiento_final_mm),
                    "lectura_hinchamiento_24h_mm": round_or_none(molde.lectura_hinchamiento_24h_mm),
                    "lectura_hinchamiento_48h_mm": round_or_none(molde.lectura_hinchamiento_48h_mm),
                    "lectura_hinchamiento_72h_mm": round_or_none(molde.lectura_hinchamiento_72h_mm),
                    "lectura_hinchamiento_96h_mm": round_or_none(molde.lectura_hinchamiento_96h_mm),
                    "lectura_hinchamiento_final_utilizada_mm": swell_detail["lectura_final_utilizada_mm"],
                    "delta_hinchamiento_mm": swell_detail["delta_hinchamiento_mm"],
                    "hinchamiento_cada_24_horas_pct": swell_detail["hinchamiento_cada_24_horas_pct"],
                    "hinchamiento_porcentaje": round_or_none(swell_pct),
                },
                "resultados": {
                    "carga_2_54": round(convert_kg_to_unit(carga_254_kg, report_load_unit), 4),
                    "carga_5_08": round(convert_kg_to_unit(carga_508_kg, report_load_unit), 4),
                    "cbr_2_54_pct": round(cbr_254, 4),
                    "cbr_5_08_pct": round(cbr_508, 4),
                    "cbr_final_pct": round(cbr_final, 4),
                    "penetracion_control": round(convert_mm_to_unit(penetration_governing_mm, report_penetration_unit), 4),
                    "unidad_penetracion": report_penetration_unit,
                    "unidad_carga": report_load_unit,
                },
                "graficas": {
                    "curva_original": chart_original,
                    "linea_correccion_origen": chart_correction_line,
                    "curva_corregida": chart_corrected,
                    "puntos_referencia": references,
                },
                "tabla_procesada": build_processed_table(
                    normalized_points,
                    corrected,
                    report_penetration_unit,
                    report_load_unit,
                ),
            }
        )

    density_vs_cbr.sort(key=lambda item: item["densidad_seca_g_cm3"])

    summary = {
        "cantidad_moldes": len(mold_results),
        "cbr_maximo_pct": max(result["resultados"]["cbr_final_pct"] for result in mold_results),
        "cbr_minimo_pct": min(result["resultados"]["cbr_final_pct"] for result in mold_results),
        "densidad_seca_maxima_g_cm3": max(
            (point["densidad_seca_g_cm3"] for point in density_vs_cbr),
            default=None,
        ),
        "hay_errores_validacion": any(result["errores_validacion"] for result in mold_results),
    }

    response = {
        "project_info": data.project_info.model_dump(),
        "sample_info": data.sample_info.model_dump(),
        "test_config": data.test_config.model_dump(),
        "resumen_general": summary,
        "moldes": mold_results,
        "graficas_finales": {
            "densidad_seca_vs_cbr": density_vs_cbr,
        },
    }

    if data.test_config.modo == "solo_grafica":
        for molde in response["moldes"]:
            molde.pop("resultados", None)
            molde.pop("lecturas", None)
            molde.pop("errores_validacion", None)

    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
