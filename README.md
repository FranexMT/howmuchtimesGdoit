# G Control

App para registrar veces y tiempo en el baño, comidas y gastos.

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
cd howmuchtimesGdoit
npm install
```

## Configurar Base de Datos

```bash
npx prisma db push
```

## Ejecutar

```bash
npm start
```

Servidor disponible en: `http://localhost:3000`

## Estructura

```
├── server.js          # Backend (Express + Prisma)
├── public/
│   ├── index.html     # Interfaz
│   ├── styles.css     # Estilos
│   └── app.js         # Frontend JS
├── prisma/
│   └── schema.prisma  # Modelo de datos
└── db/                # Base de datos SQLite
```

## Uso

1. Abrir `http://localhost:3000` en el navegador
2. Click en **Baño** para iniciar timer, click de nuevo para registrar
3. Click en **Comida** para registrar tipo y precio
4. Ver estadísticas en las pestañas Diario/Semanal/Mensual

## API Endpoints

- `POST /api/bathroom` - Registrar baño
- `POST /api/food` - Registrar comida
- `DELETE /api/bathroom/:id` - Eliminar registro
- `DELETE /api/food/:id` - Eliminar registro
- `GET /api/stats/daily` - Estadísticas diarias
- `GET /api/stats/weekly` - Estadísticas semanales
- `GET /api/stats/monthly` - Estadísticas mensuales
- `GET /api/chart/:period` - Datos para gráficas
