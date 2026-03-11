const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('functional_manager','hr_director','hr_manager')),
      department TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      requirements_json TEXT DEFAULT '[]',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS requirement_classifiers (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_positions (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      requirements_json TEXT DEFAULT '[]',
      department TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vacancy_requests (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      department TEXT,
      salary_from INTEGER,
      salary_to INTEGER,
      status TEXT DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      assigned_manager_id INTEGER REFERENCES users(id),
      template_id INTEGER REFERENCES request_templates(id),
      requirements_json TEXT DEFAULT '[]',
      clarification_notes TEXT,
      clarification_response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      resume_text TEXT,
      source TEXT DEFAULT 'external' CHECK(source IN ('internal','external')),
      current_position TEXT,
      experience_years INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      vacancy_request_id INTEGER REFERENCES vacancy_requests(id),
      candidate_id INTEGER REFERENCES candidates(id),
      status TEXT DEFAULT 'search',
      rejection_reason TEXT,
      approval_comment TEXT,
      manager_comment TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interviews (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id),
      scheduled_at TIMESTAMP NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      location TEXT,
      calendar_link TEXT,
      participants_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','conducted','cancelled')),
      notes TEXT,
      is_additional BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_assignments (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id),
      description TEXT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deadline TIMESTAMP,
      submitted_at TIMESTAMP,
      submission_notes TEXT,
      evaluation_score INTEGER,
      evaluator_comment TEXT,
      evaluated_by INTEGER REFERENCES users(id),
      evaluated_at TIMESTAMP,
      status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned','submitted','evaluated')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id),
      salary INTEGER NOT NULL,
      additional_conditions TEXT,
      status TEXT DEFAULT 'prepared' CHECK(status IN ('prepared','sent','accepted','declined')),
      sent_at TIMESTAMP,
      response_at TIMESTAMP,
      response_notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workplace_tasks (
      id SERIAL PRIMARY KEY,
      application_id INTEGER REFERENCES applications(id),
      title TEXT NOT NULL,
      description TEXT,
      assigned_to INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
      due_date DATE,
      completed_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) === 0) {
    await seedData();
  }

  console.log('Database initialized');
}

async function seedData() {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const managerHash = bcrypt.hashSync('manager123', 10);
  const leadHash = bcrypt.hashSync('lead123', 10);

  const { rows: [admin] } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    ['Анна Директорова', 'admin@hirecrm.ru', adminHash, 'hr_director', 'HR']
  );
  const { rows: [manager] } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    ['Михаил Менеджеров', 'manager@hirecrm.ru', managerHash, 'hr_manager', 'HR']
  );
  const { rows: [lead] } = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    ['Сергей Руководителев', 'lead@hirecrm.ru', leadHash, 'functional_manager', 'Разработка']
  );

  await pool.query(
    'INSERT INTO request_templates (name, description, requirements_json, created_by) VALUES ($1, $2, $3, $4)',
    ['Разработчик ПО', 'Шаблон для найма разработчиков программного обеспечения', JSON.stringify(['JavaScript', 'React', 'Node.js', '3+ лет опыта']), lead.id]
  );
  await pool.query(
    'INSERT INTO request_templates (name, description, requirements_json, created_by) VALUES ($1, $2, $3, $4)',
    ['Аналитик данных', 'Шаблон для найма аналитиков данных', JSON.stringify(['Python', 'SQL', 'Excel', 'BI-инструменты']), lead.id]
  );
  await pool.query(
    'INSERT INTO request_templates (name, description, requirements_json, created_by) VALUES ($1, $2, $3, $4)',
    ['Менеджер проекта', 'Шаблон для найма менеджеров проекта', JSON.stringify(['PMP/PRINCE2', 'Agile/Scrum', 'Управление командой']), lead.id]
  );

  const techSkills = ['JavaScript', 'Python', 'SQL', 'React', 'Node.js', 'Java', 'C++', 'Docker', 'Kubernetes', 'AWS'];
  for (const skill of techSkills) {
    await pool.query('INSERT INTO requirement_classifiers (category, name) VALUES ($1, $2)', ['Технические навыки', skill]);
  }
  const softSkills = ['Коммуникабельность', 'Лидерство', 'Работа в команде', 'Аналитическое мышление', 'Тайм-менеджмент'];
  for (const skill of softSkills) {
    await pool.query('INSERT INTO requirement_classifiers (category, name) VALUES ($1, $2)', ['Soft skills', skill]);
  }
  const education = ['Высшее техническое', 'Высшее экономическое', 'MBA', 'Среднее специальное'];
  for (const edu of education) {
    await pool.query('INSERT INTO requirement_classifiers (category, name) VALUES ($1, $2)', ['Образование', edu]);
  }
  const experience = ['1+ лет', '3+ лет', '5+ лет', 'Без опыта'];
  for (const exp of experience) {
    await pool.query('INSERT INTO requirement_classifiers (category, name) VALUES ($1, $2)', ['Опыт', exp]);
  }

  await pool.query('INSERT INTO staff_positions (title, description, requirements_json, department) VALUES ($1, $2, $3, $4)',
    ['Senior Frontend Developer', 'Старший разработчик интерфейсов', JSON.stringify(['JavaScript', 'React', '5+ лет']), 'Разработка']);
  await pool.query('INSERT INTO staff_positions (title, description, requirements_json, department) VALUES ($1, $2, $3, $4)',
    ['Data Scientist', 'Специалист по анализу данных', JSON.stringify(['Python', 'SQL', 'Machine Learning']), 'Аналитика']);
  await pool.query('INSERT INTO staff_positions (title, description, requirements_json, department) VALUES ($1, $2, $3, $4)',
    ['Project Manager', 'Менеджер проектов', JSON.stringify(['Agile', 'Scrum', 'PMP']), 'Управление']);
  await pool.query('INSERT INTO staff_positions (title, description, requirements_json, department) VALUES ($1, $2, $3, $4)',
    ['Backend Developer', 'Разработчик серверной части', JSON.stringify(['Node.js', 'Java', 'Docker']), 'Разработка']);
  await pool.query('INSERT INTO staff_positions (title, description, requirements_json, department) VALUES ($1, $2, $3, $4)',
    ['Business Analyst', 'Бизнес-аналитик', JSON.stringify(['SQL', 'Excel', 'BPMN']), 'Аналитика']);

  const { rows: [c1] } = await pool.query(
    'INSERT INTO candidates (name, email, phone, resume_text, source, current_position, experience_years, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    ['Иван Петров', 'ivan.petrov@email.ru', '+7-999-111-2233', 'Опытный frontend разработчик с 5 годами опыта в React и TypeScript', 'external', 'Frontend Developer', 5, manager.id]
  );
  const { rows: [c2] } = await pool.query(
    'INSERT INTO candidates (name, email, phone, resume_text, source, current_position, experience_years, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    ['Мария Сидорова', 'maria.sidorova@email.ru', '+7-999-444-5566', 'Аналитик данных, работала с Python, SQL, Tableau', 'external', 'Data Analyst', 3, manager.id]
  );
  await pool.query(
    'INSERT INTO candidates (name, email, phone, resume_text, source, current_position, experience_years, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    ['Алексей Козлов', 'alexey.kozlov@company.ru', '+7-999-777-8899', 'Внутренний кандидат, текущая роль: Junior Developer', 'internal', 'Junior Developer', 2, manager.id]
  );
  await pool.query(
    'INSERT INTO candidates (name, email, phone, resume_text, source, current_position, experience_years, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    ['Екатерина Новикова', 'ekaterina.novikova@email.ru', '+7-999-000-1122', 'PM с опытом управления командами до 15 человек', 'external', 'Project Manager', 7, manager.id]
  );
  await pool.query(
    'INSERT INTO candidates (name, email, phone, resume_text, source, current_position, experience_years, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    ['Дмитрий Волков', 'dmitry.volkov@email.ru', '+7-999-333-4455', 'Backend разработчик, специализация Node.js и микросервисы', 'external', 'Backend Developer', 4, manager.id]
  );

  const { rows: [r1] } = await pool.query(
    `INSERT INTO vacancy_requests (title, description, department, salary_from, salary_to, status, created_by, assigned_manager_id, requirements_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    ['Senior React Developer', 'Ищем опытного React разработчика для работы над основным продуктом компании', 'Разработка', 150000, 200000, 'assigned', lead.id, manager.id, JSON.stringify(['JavaScript', 'React', 'Node.js', '3+ лет опыта'])]
  );
  const { rows: [r2] } = await pool.query(
    `INSERT INTO vacancy_requests (title, description, department, salary_from, salary_to, status, created_by, requirements_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    ['Data Analyst', 'Требуется аналитик для работы с большими данными и BI-отчётностью', 'Аналитика', 100000, 140000, 'pending_assignment', lead.id, JSON.stringify(['Python', 'SQL', 'Excel'])]
  );
  await pool.query(
    `INSERT INTO vacancy_requests (title, description, department, salary_from, salary_to, status, created_by, requirements_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ['Project Manager', 'Опытный PM для ведения нескольких параллельных проектов', 'Управление', 130000, 170000, 'draft', lead.id, JSON.stringify(['Agile/Scrum', 'Управление командой'])]
  );

  const { rows: [app1] } = await pool.query(
    'INSERT INTO applications (vacancy_request_id, candidate_id, status, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [r1.id, c1.id, 'interview_conducted', manager.id]
  );
  const { rows: [app2] } = await pool.query(
    'INSERT INTO applications (vacancy_request_id, candidate_id, status, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [r2.id, c2.id, 'test_assigned', manager.id]
  );

  await pool.query(
    `INSERT INTO interviews (application_id, scheduled_at, duration_minutes, location, calendar_link, participants_json, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [app1.id, '2026-03-05 14:00:00', 60, 'Конференц-зал А', 'https://calendar.yandex.ru/event/12345',
     JSON.stringify(['Михаил Менеджеров', 'Сергей Руководителев']), 'conducted',
     'Кандидат произвёл хорошее впечатление, технические навыки на высоком уровне']
  );

  await pool.query(
    'INSERT INTO test_assignments (application_id, description, deadline, status) VALUES ($1, $2, $3, $4)',
    [app2.id, 'Создать дашборд в Power BI на основе предоставленного датасета. Показать ключевые метрики продаж за последние 12 месяцев.', '2026-03-20 23:59:59', 'assigned']
  );

  console.log('Database seeded successfully');
}

module.exports = { pool, initializeDatabase };
