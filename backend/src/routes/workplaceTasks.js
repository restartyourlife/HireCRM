const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /workplace-tasks:
 *   get:
 *     summary: Получить список задач по рабочим местам
 *     tags: [WorkplaceTasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, assigned_to, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`wt.status = $${params.length}`);
    }
    if (assigned_to) {
      params.push(assigned_to);
      conditions.push(`wt.assigned_to = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM workplace_tasks wt ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT wt.*, c.name as candidate_name, vr.title as vacancy_title, u.name as assigned_to_name
      FROM workplace_tasks wt
      LEFT JOIN applications a ON wt.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      LEFT JOIN users u ON wt.assigned_to = u.id
      ${where}
      ORDER BY wt.created_at DESC
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
 * /workplace-tasks:
 *   post:
 *     summary: Создать задачу по рабочему месту
 *     tags: [WorkplaceTasks]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_manager', 'hr_director'), async (req, res) => {
  try {
    const { application_id, title, description, assigned_to, due_date } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Название задачи обязательно' });

    const { rows } = await pool.query(
      "INSERT INTO workplace_tasks (application_id, title, description, assigned_to, due_date, status, created_by) VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *",
      [application_id, title, description, assigned_to, due_date, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /workplace-tasks/{id}:
 *   get:
 *     summary: Получить задачу по ID
 *     tags: [WorkplaceTasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT wt.*, c.name as candidate_name, vr.title as vacancy_title, u.name as assigned_to_name
      FROM workplace_tasks wt
      LEFT JOIN applications a ON wt.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      LEFT JOIN users u ON wt.assigned_to = u.id
      WHERE wt.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Задача не найдена' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /workplace-tasks/{id}:
 *   put:
 *     summary: Обновить задачу
 *     tags: [WorkplaceTasks]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('hr_manager', 'hr_director'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM workplace_tasks WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Задача не найдена' });
    const wt = existing[0];
    const { title, description, assigned_to, due_date, status } = req.body;

    const { rows } = await pool.query(`
      UPDATE workplace_tasks
      SET title = $1, description = $2, assigned_to = $3, due_date = $4, status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 RETURNING *
    `, [
      title || wt.title,
      description !== undefined ? description : wt.description,
      assigned_to !== undefined ? assigned_to : wt.assigned_to,
      due_date !== undefined ? due_date : wt.due_date,
      status || wt.status,
      req.params.id
    ]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /workplace-tasks/{id}/complete:
 *   post:
 *     summary: Завершить задачу
 *     tags: [WorkplaceTasks]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM workplace_tasks WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Задача не найдена' });

    const { rows } = await pool.query(
      "UPDATE workplace_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
