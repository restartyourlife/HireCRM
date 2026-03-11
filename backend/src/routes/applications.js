const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

async function getApplicationWithDetails(id) {
  const { rows } = await pool.query(`
    SELECT a.*,
      c.name as candidate_name, c.email as candidate_email, c.phone as candidate_phone,
      c.source as candidate_source, c.current_position, c.experience_years,
      vr.title as vacancy_title, vr.department, vr.salary_from, vr.salary_to,
      u1.name as creator_name,
      u2.name as manager_name
    FROM applications a
    LEFT JOIN candidates c ON a.candidate_id = c.id
    LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
    LEFT JOIN users u1 ON a.created_by = u1.id
    LEFT JOIN users u2 ON vr.assigned_manager_id = u2.id
    WHERE a.id = $1
  `, [id]);

  if (!rows[0]) return null;
  const app = rows[0];

  const [interviewsRes, testsRes, offersRes] = await Promise.all([
    pool.query('SELECT * FROM interviews WHERE application_id = $1 ORDER BY scheduled_at', [id]),
    pool.query('SELECT * FROM test_assignments WHERE application_id = $1 ORDER BY created_at', [id]),
    pool.query('SELECT * FROM offers WHERE application_id = $1 ORDER BY created_at', [id])
  ]);

  app.interviews = interviewsRes.rows;
  app.test_assignments = testsRes.rows;
  app.offers = offersRes.rows;
  return app;
}

/**
 * @swagger
 * /applications:
 *   get:
 *     summary: Получить список заявок
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, vacancy_request_id, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (req.user.role === 'functional_manager') {
      params.push(req.user.id);
      conditions.push(`vr.created_by = $${params.length}`);
    } else if (req.user.role === 'hr_manager') {
      params.push(req.user.id);
      conditions.push(`vr.assigned_manager_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (vacancy_request_id) {
      params.push(vacancy_request_id);
      conditions.push(`a.vacancy_request_id = $${params.length}`);
    }

    const joins = 'LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id';
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM applications a ${joins} ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT a.*, c.name as candidate_name, c.email as candidate_email, vr.title as vacancy_title, vr.department
      FROM applications a
      ${joins}
      LEFT JOIN candidates c ON a.candidate_id = c.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
    `, listParams);

    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications:
 *   post:
 *     summary: Создать заявку на кандидата
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { vacancy_request_id, candidate_id } = req.body;
    if (!vacancy_request_id || !candidate_id) {
      return res.status(400).json({ success: false, message: 'vacancy_request_id и candidate_id обязательны' });
    }

    const { rows: reqRows } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [vacancy_request_id]);
    if (!reqRows[0]) return res.status(404).json({ success: false, message: 'Заявка на вакансию не найдена' });

    const { rows: candRows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [candidate_id]);
    if (!candRows[0]) return res.status(404).json({ success: false, message: 'Кандидат не найден' });

    const { rows } = await pool.query(
      "INSERT INTO applications (vacancy_request_id, candidate_id, status, created_by) VALUES ($1, $2, 'search', $3) RETURNING id",
      [vacancy_request_id, candidate_id, req.user.id]
    );
    const app = await getApplicationWithDetails(rows[0].id);
    res.status(201).json({ success: true, data: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}:
 *   get:
 *     summary: Получить заявку по ID
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const app = await getApplicationWithDetails(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    res.json({ success: true, data: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/schedule-interview:
 *   post:
 *     summary: Запланировать собеседование
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/schedule-interview', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { scheduled_at, duration_minutes, location, calendar_link, participants, is_additional } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    if (!scheduled_at) return res.status(400).json({ success: false, message: 'Дата собеседования обязательна' });

    await pool.query(`
      INSERT INTO interviews (application_id, scheduled_at, duration_minutes, location, calendar_link, participants_json, is_additional)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.params.id, scheduled_at, duration_minutes || 60, location, calendar_link,
        JSON.stringify(participants || []), is_additional || false]);

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['interview_scheduled', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/mark-interview-conducted:
 *   post:
 *     summary: Отметить собеседование проведённым
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/mark-interview-conducted', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { interview_id, notes } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    if (interview_id) {
      await pool.query(
        'UPDATE interviews SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['conducted', notes, interview_id]
      );
    }

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['interview_conducted', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/assign-test:
 *   post:
 *     summary: Назначить тестовое задание
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/assign-test', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { description, deadline } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    if (!description) return res.status(400).json({ success: false, message: 'Описание задания обязательно' });

    await pool.query(
      "INSERT INTO test_assignments (application_id, description, deadline, status) VALUES ($1, $2, $3, 'assigned')",
      [req.params.id, description, deadline]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['test_assigned', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/submit-test:
 *   post:
 *     summary: Отметить тест выполненным
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/submit-test', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { test_assignment_id, submission_notes } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    if (test_assignment_id) {
      await pool.query(
        "UPDATE test_assignments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, submission_notes = $1 WHERE id = $2",
        [submission_notes, test_assignment_id]
      );
    } else {
      await pool.query(
        "UPDATE test_assignments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, submission_notes = $1 WHERE application_id = $2 AND status = 'assigned'",
        [submission_notes, req.params.id]
      );
    }

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['test_submitted', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/evaluate-test:
 *   post:
 *     summary: Оценить тестовое задание
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/evaluate-test', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { test_assignment_id, evaluation_score, evaluator_comment } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    let testId = test_assignment_id;
    if (!testId) {
      const { rows: testRows } = await pool.query(
        "SELECT id FROM test_assignments WHERE application_id = $1 AND status = 'submitted' ORDER BY created_at DESC LIMIT 1",
        [req.params.id]
      );
      testId = testRows[0]?.id;
    }
    if (!testId) return res.status(400).json({ success: false, message: 'Тестовое задание не найдено' });

    await pool.query(
      "UPDATE test_assignments SET status = 'evaluated', evaluation_score = $1, evaluator_comment = $2, evaluated_by = $3, evaluated_at = CURRENT_TIMESTAMP WHERE id = $4",
      [evaluation_score, evaluator_comment, req.user.id, testId]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['test_evaluated', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/send-for-approval:
 *   post:
 *     summary: Отправить на согласование
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/send-for-approval', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['pending_candidate_approval', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/approve-candidate:
 *   post:
 *     summary: Согласовать кандидата
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/approve-candidate', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { approval_comment } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    if (appRows[0].status !== 'pending_candidate_approval') {
      return res.status(400).json({ success: false, message: 'Заявка не ожидает согласования' });
    }

    await pool.query(
      'UPDATE applications SET status = $1, approval_comment = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['candidate_approved', approval_comment, req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/reject:
 *   post:
 *     summary: Отклонить заявку
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    if (!['hr_manager', 'functional_manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Нет прав' });
    }

    await pool.query(
      'UPDATE applications SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['rejected', rejection_reason, req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/prepare-offer:
 *   post:
 *     summary: Подготовить оффер
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/prepare-offer', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { salary, additional_conditions } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    if (appRows[0].status !== 'candidate_approved') {
      return res.status(400).json({ success: false, message: 'Кандидат не согласован' });
    }
    if (!salary) return res.status(400).json({ success: false, message: 'Зарплата обязательна' });

    await pool.query(
      "INSERT INTO offers (application_id, salary, additional_conditions, status, created_by) VALUES ($1, $2, $3, 'prepared', $4)",
      [req.params.id, salary, additional_conditions, req.user.id]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['offer_prepared', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/accept-offer:
 *   post:
 *     summary: Принять оффер
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/accept-offer', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { response_notes } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    const { rows: offerRows } = await pool.query(
      'SELECT * FROM offers WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]
    );
    if (offerRows[0]) {
      await pool.query(
        'UPDATE offers SET status = $1, response_at = CURRENT_TIMESTAMP, response_notes = $2 WHERE id = $3',
        ['accepted', response_notes, offerRows[0].id]
      );
    }

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['offer_accepted', req.params.id]
    );

    const { rows: candRows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [appRows[0].candidate_id]);
    const { rows: vacRows } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [appRows[0].vacancy_request_id]);
    const candidate = candRows[0];
    const vacancy = vacRows[0];

    await pool.query(
      "INSERT INTO workplace_tasks (application_id, title, description, status, created_by) VALUES ($1, $2, $3, 'pending', $4)",
      [req.params.id,
       `Подготовка рабочего места для ${candidate?.name || 'нового сотрудника'}`,
       `Подготовить рабочее место для сотрудника ${candidate?.name} на позиции ${vacancy?.title}. Выдать оборудование, доступы и оформить документы.`,
       req.user.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /applications/{id}/decline-offer:
 *   post:
 *     summary: Отклонить оффер
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/decline-offer', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { response_notes } = req.body;
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!appRows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });

    const { rows: offerRows } = await pool.query(
      'SELECT * FROM offers WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]
    );
    if (offerRows[0]) {
      await pool.query(
        'UPDATE offers SET status = $1, response_at = CURRENT_TIMESTAMP, response_notes = $2 WHERE id = $3',
        ['declined', response_notes, offerRows[0].id]
      );
    }

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['offer_declined', req.params.id]
    );

    const updated = await getApplicationWithDetails(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
