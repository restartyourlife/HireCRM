const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /test-assignments:
 *   get:
 *     summary: Получить список тестовых заданий
 *     tags: [TestAssignments]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { application_id, status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (application_id) {
      params.push(application_id);
      conditions.push(`ta.application_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`ta.status = $${params.length}`);
    }

    if (req.user.role === 'functional_manager') {
      params.push(req.user.id);
      conditions.push(`vr.created_by = $${params.length}`);
    } else if (req.user.role === 'hr_manager') {
      params.push(req.user.id);
      conditions.push(`vr.assigned_manager_id = $${params.length}`);
    }

    const joins = `
      LEFT JOIN applications a ON ta.application_id = a.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
    `;
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM test_assignments ta ${joins} ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT ta.*, c.name as candidate_name, vr.title as vacancy_title
      FROM test_assignments ta
      ${joins}
      ${where}
      ORDER BY ta.created_at DESC
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
 * /test-assignments:
 *   post:
 *     summary: Создать тестовое задание
 *     tags: [TestAssignments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { application_id, description, deadline } = req.body;
    if (!application_id || !description) {
      return res.status(400).json({ success: false, message: 'application_id и description обязательны' });
    }

    const { rows } = await pool.query(
      "INSERT INTO test_assignments (application_id, description, deadline, status) VALUES ($1, $2, $3, 'assigned') RETURNING *",
      [application_id, description, deadline]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['test_assigned', application_id]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /test-assignments/{id}:
 *   get:
 *     summary: Получить тестовое задание по ID
 *     tags: [TestAssignments]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ta.*, c.name as candidate_name, vr.title as vacancy_title
      FROM test_assignments ta
      LEFT JOIN applications a ON ta.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      WHERE ta.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Тестовое задание не найдено' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /test-assignments/{id}:
 *   put:
 *     summary: Обновить тестовое задание
 *     tags: [TestAssignments]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM test_assignments WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Тестовое задание не найдено' });
    const ta = existing[0];
    const { description, deadline } = req.body;

    const { rows } = await pool.query(
      'UPDATE test_assignments SET description = $1, deadline = $2 WHERE id = $3 RETURNING *',
      [description || ta.description, deadline !== undefined ? deadline : ta.deadline, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /test-assignments/{id}/submit:
 *   post:
 *     summary: Отметить задание выполненным
 *     tags: [TestAssignments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/submit', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { submission_notes } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM test_assignments WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Тестовое задание не найдено' });

    const { rows } = await pool.query(
      "UPDATE test_assignments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, submission_notes = $1 WHERE id = $2 RETURNING *",
      [submission_notes, req.params.id]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['test_submitted', existing[0].application_id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /test-assignments/{id}/evaluate:
 *   post:
 *     summary: Оценить тестовое задание
 *     tags: [TestAssignments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/evaluate', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { evaluation_score, evaluator_comment } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM test_assignments WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Тестовое задание не найдено' });
    if (existing[0].status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Задание не сдано кандидатом' });
    }

    const { rows } = await pool.query(
      "UPDATE test_assignments SET status = 'evaluated', evaluation_score = $1, evaluator_comment = $2, evaluated_by = $3, evaluated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
      [evaluation_score, evaluator_comment, req.user.id, req.params.id]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['test_evaluated', existing[0].application_id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
