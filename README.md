# App CBR - Primera etapa

Esta versión incluye:

- Ingreso de datos generales del ensayo.
- Ingreso manual de la tabla carga-penetración.
- Modo **Reporte completo**.
- Modo **Solo graficar**.
- Corrección automática aproximada del origen cuando la curva inicial sugiere asiento inicial.
- Cálculo de CBR a 2.54 mm y 5.08 mm.
- Selección automática del CBR final según el mayor valor calculado.
- Gráficas original y corregida.

## Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API en:
- http://127.0.0.1:8000
- Documentación: http://127.0.0.1:8000/docs

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Si tu backend está en otra dirección, crea un archivo `.env` dentro de `frontend`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## Despliegue

### GitHub

Conviene usar `cbr_app` como repositorio independiente.

```bash
cd cbr_app
git init
git add .
git commit -m "Initial commit"
```

Luego crea un repositorio en GitHub y conecta el remoto:

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git branch -M main
git push -u origin main
```

### Vercel

Se recomienda desplegar en **dos proyectos**:

1. `frontend`
2. `backend`

#### Backend en Vercel

- Root Directory: `backend`
- Framework Preset: `Other`
- El archivo `backend/vercel.json` redirige todas las rutas a FastAPI.

La URL resultante sera algo como:

```env
https://tu-backend.vercel.app
```

#### Frontend en Vercel

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Variable de entorno:

```env
VITE_API_URL=https://tu-backend.vercel.app
```

Si activas acceso con Google usando Firebase Auth, agrega tambien:

```env
VITE_ALLOWED_EMAILS=amariovp20@gmail.com,pacoridurandestiwarandrus@gmail.com,allyscastro8@gmail.com,andavid.vel1210@gmail.com,dannavarro0105@gmail.com,karinahuansi223@gmail.com,gisell.sandoval@sismoingps.com
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_APP_ID=tu_app_id
```

Con `VITE_ALLOWED_EMAILS` puedes poner varios correos separados por coma.

Despues vuelve a desplegar el frontend para que use la API publicada.

## Próxima etapa sugerida

1. Generación del reporte PDF con logo del laboratorio.
2. Carga automática de varias muestras.
3. Incorporación de molde, humedad, densidades y sobrecarga.
4. Comparación entre muestras o energías de compactación.
5. Exportación a Excel y base de datos de ensayos.

## Nota técnica

La lógica de corrección implementada en esta primera etapa usa una heurística práctica para desplazar el origen cuando el tramo inicial presenta concavidad y asiento inicial. Antes de usarla como versión final de laboratorio, conviene validar el criterio con tu formato de ensayo y norma interna.
