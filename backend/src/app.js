require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { initializeDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const requestsRoutes = require('./routes/requests');
const templatesRoutes = require('./routes/templates');
const classifiersRoutes = require('./routes/classifiers');
const candidatesRoutes = require('./routes/candidates');
const applicationsRoutes = require('./routes/applications');
const interviewsRoutes = require('./routes/interviews');
const testAssignmentsRoutes = require('./routes/testAssignments');
const offersRoutes = require('./routes/offers');
const workplaceTasksRoutes = require('./routes/workplaceTasks');

const app = express();
const PORT = process.env.PORT || 3001;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173'];

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'HireCRM API', version: '1.0.0', description: 'HR Recruitment CRM REST API' },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="openapi.json"');
  res.json(swaggerSpec);
});
app.get('/api/docs.yaml', (_req, res) => {
  const yaml = require('js-yaml');
  res.setHeader('Content-Disposition', 'attachment; filename="openapi.yaml"');
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yaml.dump(swaggerSpec));
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/classifiers', classifiersRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/interviews', interviewsRoutes);
app.use('/api/test-assignments', testAssignmentsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/workplace-tasks', workplaceTasksRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HireCRM API is running', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Маршрут не найден' });
});

async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`HireCRM Backend running on port ${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api/docs`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
